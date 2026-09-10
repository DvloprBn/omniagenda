#!/usr/bin/env bash
# Barrido de control de acceso de la Fase 3 (metodo del CHECKLIST de
# seguridad, "Como verificar el control de acceso"): se golpea CADA ruta
# real del framework SIN autenticacion y se clasifica por codigo. Lo que
# NO responde 401 en una ruta protegida es un hallazgo.
#
# Requiere el stack arriba (docker compose up -d) y el seed corrido.
#   bash omniagenda_backend/test/auth-sweep.sh
set -u
API="${API:-http://localhost:3060}"
PASS=0; FAIL=0
JAR=$(mktemp); JAR2=$(mktemp); JAR3=$(mktemp)
trap 'rm -f "$JAR" "$JAR2" "$JAR3"' EXIT

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# El paso 2 del login tiene rate limit de 5/min por IP (OWASP API2). Este
# barrido hace varios logins seguidos, asi que limpia esas llaves de Redis
# antes de correr — es un tool de desarrollo, se deja constancia aqui.
if command -v docker >/dev/null; then
  docker compose exec -T omniagenda_redis sh -lc \
    'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning --scan --pattern "*login*" | xargs -r redis-cli -a "$REDIS_PASSWORD" --no-auth-warning del' \
    >/dev/null 2>&1 || true
fi


check() { # <descripcion> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then echo "  PASS  $1 (=$3)"; PASS=$((PASS+1));
  else echo "  FAIL  $1 (esperaba $2, obtuvo $3)"; FAIL=$((FAIL+1)); fi
}

echo "== 1. Rutas PROTEGIDAS sin sesion -> deben dar 401 =="
for r in \
  "GET  /auth/me" \
  "PATCH /auth/me/password" \
  "GET  /users" \
  "POST /users" \
  "GET  /roles" \
  "POST /roles" \
  "GET  /security-events" \
  "POST /two-factor/setup" \
  "POST /two-factor/disable" ; do
  m=${r%% *}; p=${r##* }
  check "$m $p" 401 "$(code -X "$m" "$API$p")"
done
# ruta de calendario (protegida; 401 antes de siquiera mirar el calendario)
check "GET /calendars/<uuid>/members" 401 "$(code "$API/calendars/00000000-0000-4000-8000-00000000ca11/members")"

echo
echo "== 2. Rutas PUBLICAS sin sesion -> NUNCA 401 (200/201/400 segun body) =="
check "POST /auth/login/step1 (body ok)" 200 "$(code -X POST -H 'content-type: application/json' --data-raw '{"email":"x@x.com"}' "$API/auth/login/step1")"
check "POST /auth/login/step2 (alcanza la ruta; 401 por creds, no por sesion)" 401 "$(code -X POST -H 'content-type: application/json' --data-raw '{"email":"nadie@x.com","password":"zzzzzzzz"}' "$API/auth/login/step2")"
check "POST /auth/forgot-password" 200 "$(code -X POST -H 'content-type: application/json' --data-raw '{"email":"nadie@x.com"}' "$API/auth/forgot-password")"
check "GET  /health" 200 "$(code "$API/health")"
# nota: login/step2 con credenciales invalidas SI da 401, pero por
# credenciales, no por "falta sesion" — el punto es que la ruta se alcanza.

echo
echo "== 3. Flujo de sesion real (registro -> me -> logout) =="
EMAIL="sweep+$(date +%s)@example.com"
reg=$(code -c "$JAR" -X POST -H 'content-type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"SweepTest123!\",\"name\":\"Sweep\"}" "$API/auth/register")
check "POST /auth/register" 201 "$reg"
check "GET /auth/me con cookie" 200 "$(code -b "$JAR" "$API/auth/me")"
check "GET /users con rol 'usuario' -> 403 (RolesGuard)" 403 "$(code -b "$JAR" "$API/users")"
check "POST /auth/logout" 200 "$(code -b "$JAR" -X POST "$API/auth/logout")"

echo
echo "== 4. Login del admin sembrado + acceso a /users =="
la=$(code -c "$JAR2" -X POST -H 'content-type: application/json' -d '{"email":"admin+omniagenda@example.com","password":"TestOnly123!"}' "$API/auth/login/step2")
check "login admin" 200 "$la"
check "GET /users como admin" 200 "$(code -b "$JAR2" "$API/users")"
check "GET /security-events como admin" 200 "$(code -b "$JAR2" "$API/security-events")"

echo
echo "== 5. Permisos POR CALENDARIO (calendario demo 'busy_only') =="
CAL=00000000-0000-4000-8000-00000000ca11
# staff global, pero 'manager' SOBRE el calendario (sembrado)
ls=$(code -c "$JAR3" -X POST -H 'content-type: application/json' -d '{"email":"staff+omniagenda@example.com","password":"TestOnly123!"}' "$API/auth/login/step2")
check "login staff" 200 "$ls"
check "GET  members  (staff = manager del calendario)" 200 "$(code -b "$JAR3" "$API/calendars/$CAL/members")"
# usuario global, 'booker' SOBRE el calendario (sembrado)
JARU=$(mktemp)
code -c "$JARU" -X POST -H 'content-type: application/json' -d '{"email":"usuario+omniagenda@example.com","password":"TestOnly123!"}' "$API/auth/login/step2" >/dev/null
check "GET  members  (usuario = booker: booker cubre viewer)" 200 "$(code -b "$JARU" "$API/calendars/$CAL/members")"
check "POST members  (usuario = booker < manager -> 403)" 403 "$(code -b "$JARU" -X POST -H 'content-type: application/json' -d '{"user_id":"00000000-0000-4000-8000-0000000000e1","calendar_role":"viewer"}' "$API/calendars/$CAL/members")"
# admin global = manager implicito en TODOS los calendarios
check "GET  members  (admin global = manager implicito)" 200 "$(code -b "$JAR2" "$API/calendars/$CAL/members")"
# la cuenta 'manager' global NO tiene membresia en este calendario y el cal
# no es 'public': sin acceso.
JARM=$(mktemp)
code -c "$JARM" -X POST -H 'content-type: application/json' -d '{"email":"manager+omniagenda@example.com","password":"TestOnly123!"}' "$API/auth/login/step2" >/dev/null
check "GET  members  (manager global, sin membresia, cal no public -> 403)" 403 "$(code -b "$JARM" "$API/calendars/$CAL/members")"
rm -f "$JARU" "$JARM"

echo
echo "================  PASS=$PASS  FAIL=$FAIL  ================"
[ "$FAIL" -eq 0 ]
