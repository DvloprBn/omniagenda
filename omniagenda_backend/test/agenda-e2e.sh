#!/usr/bin/env bash
# Verificación end-to-end de la API de agenda (Fase 4) contra el stack en
# vivo. El caso central: una doble-reserva por la API real es RECHAZADA.
#   bash omniagenda_backend/test/agenda-e2e.sh
set -u
API="${API:-http://localhost:3060}"
PASS=0; FAIL=0
JADMIN=$(mktemp); JUSER=$(mktemp)
trap 'rm -f "$JADMIN" "$JUSER"' EXIT

# Rate limit del login: 5/min por IP. Redis aqui solo tiene contadores
# efimeros (throttler + fuerza bruta) -> FLUSHDB es seguro en dev.
set -a; . "$(dirname "$0")/../../.env" 2>/dev/null; set +a
docker compose exec -e RP="${REDIS_PASSWORD:-}" -T omniagenda_redis sh -lc 'redis-cli -a "$RP" --no-auth-warning FLUSHDB' >/dev/null 2>&1 || true

jqget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check() { if [ "$2" = "$3" ]; then echo "  PASS  $1 (=$3)"; PASS=$((PASS+1)); else echo "  FAIL  $1 (esperaba $2, obtuvo $3)"; FAIL=$((FAIL+1)); fi; }

curl -s -c "$JADMIN" -X POST -H 'content-type: application/json' --data-raw '{"email":"admin+omniagenda@example.com","password":"TestOnly123!"}' "$API/auth/login/step2" -o /dev/null
curl -s -c "$JUSER"  -X POST -H 'content-type: application/json' --data-raw '{"email":"usuario+omniagenda@example.com","password":"TestOnly123!"}' "$API/auth/login/step2" -o /dev/null

echo "== 1. recurso + calendario + horario =="
RID=$(curl -s -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw '{"name":"Recurso E2E","kind":"person"}' "$API/resources" | jqget "['resource_id']")
check "POST /resources" 36 "${#RID}"
CID=$(curl -s -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw '{"name":"Cal E2E","timezone":"America/Mexico_City","visibility":"private"}' "$API/calendars" | jqget "['calendar_id']")
check "POST /calendars (creador = manager)" 36 "${#CID}"
check "PUT schedule-rule L-V 09-17" 200 "$(code -b "$JADMIN" -X PUT -H 'content-type: application/json' --data-raw '{"weekly_hours":{"mon":{"open":"09:00","close":"17:00"},"tue":{"open":"09:00","close":"17:00"},"wed":{"open":"09:00","close":"17:00"},"thu":{"open":"09:00","close":"17:00"},"fri":{"open":"09:00","close":"17:00"}}}' "$API/calendars/$CID/schedule-rules/$RID")"

echo
echo "== 2. LA garantía: doble-reserva por la API =="
B1=$(curl -s -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw "{\"title\":\"B1\",\"starts_at\":\"2026-06-15T10:00:00-06:00\",\"ends_at\":\"2026-06-15T11:00:00-06:00\",\"resource_ids\":[\"$RID\"]}" "$API/calendars/$CID/bookings")
check "POST booking B1 (10-11)" 36 "$(echo "$B1" | jqget "['booking_id']" | tr -d '\n' | wc -c)"
check "POST booking SOLAPADO (10:30-11:30) -> 409" 409 "$(code -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-06-15T10:30:00-06:00\",\"ends_at\":\"2026-06-15T11:30:00-06:00\",\"resource_ids\":[\"$RID\"]}" "$API/calendars/$CID/bookings")"
check "POST booking ADYACENTE (11-12) -> 201" 201 "$(code -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-06-15T11:00:00-06:00\",\"ends_at\":\"2026-06-15T12:00:00-06:00\",\"resource_ids\":[\"$RID\"]}" "$API/calendars/$CID/bookings")"

echo
echo "== 3. multi-recurso =="
RID2=$(curl -s -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw '{"name":"Recurso E2E 2","kind":"room"}' "$API/resources" | jqget "['resource_id']")
check "POST booking multi (R1+R2, 14-15) -> 201" 201 "$(code -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-06-15T14:00:00-06:00\",\"ends_at\":\"2026-06-15T15:00:00-06:00\",\"resource_ids\":[\"$RID\",\"$RID2\"]}" "$API/calendars/$CID/bookings")"
check "POST booking que choca SOLO con R2 (14:30-15:30) -> 409" 409 "$(code -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-06-15T14:30:00-06:00\",\"ends_at\":\"2026-06-15T15:30:00-06:00\",\"resource_ids\":[\"$RID2\"]}" "$API/calendars/$CID/bookings")"

echo
echo "== 4. mover y cancelar =="
BID=$(echo "$B1" | jqget "['booking_id']")
check "PATCH mover B1 a 15:30-16:00 (libre) -> 200" 200 "$(code -b "$JADMIN" -X PATCH -H 'content-type: application/json' --data-raw '{"starts_at":"2026-06-15T15:30:00-06:00","ends_at":"2026-06-15T16:00:00-06:00"}' "$API/calendars/$CID/bookings/$BID")"
check "PATCH cancelar B1 -> 200" 200 "$(code -b "$JADMIN" -X PATCH -H 'content-type: application/json' --data-raw '{"status":"cancelada"}' "$API/calendars/$CID/bookings/$BID/status")"
check "POST booking en el hueco que B1 dejó libre (15:30-16:00) -> 201" 201 "$(code -b "$JADMIN" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-06-15T15:30:00-06:00\",\"ends_at\":\"2026-06-15T16:00:00-06:00\",\"resource_ids\":[\"$RID\"]}" "$API/calendars/$CID/bookings")"

echo
echo "== 5. disponibilidad (usa @omniagenda/core) =="
AV=$(curl -s -b "$JADMIN" "$API/calendars/$CID/availability?resource_id=$RID&from=2026-06-15T00:00:00-06:00&to=2026-06-16T00:00:00-06:00")
echo "  huecos libres: $AV"
check "availability devuelve un array" "list" "$(echo "$AV" | python3 -c "import sys,json;print(type(json.load(sys.stdin)).__name__.replace('list','list'))")"
# 09-10 debe estar libre (nada reservado antes de las 10); 10-11 NO (B... espera, B1 se movió/canceló). Tras el test: 11-12 ocupado, 14-15 ocupado, 15:30-16 ocupado.
check "09:00 aparece como inicio de un hueco libre" "yes" "$(echo "$AV" | python3 -c "
import sys,json,datetime
free=json.load(sys.stdin)
nine=datetime.datetime.fromisoformat('2026-06-15T09:00:00-06:00').timestamp()*1000
print('yes' if any(abs(i['start']-nine)<1000 for i in free) else 'no')")"

echo
echo "== 6. permisos por calendario en la API de reservas =="
# 'usuario' es booker del calendario DEMO sembrado, no de este.
CAL_DEMO=00000000-0000-4000-8000-00000000ca11
RID_DEMO=00000000-0000-4000-8000-0000000000e1
check "usuario (booker del demo) crea reserva en el demo -> 201/409" "ok" "$(c=$(code -b "$JUSER" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-07-20T12:00:00-06:00\",\"ends_at\":\"2026-07-20T13:00:00-06:00\",\"resource_ids\":[\"$RID_DEMO\"]}" "$API/calendars/$CAL_DEMO/bookings"); [ "$c" = 201 ] || [ "$c" = 409 ] && echo ok || echo "$c")"
check "usuario NO es miembro de Cal E2E -> POST reserva 403" 403 "$(code -b "$JUSER" -X POST -H 'content-type: application/json' --data-raw "{\"starts_at\":\"2026-06-15T09:00:00-06:00\",\"ends_at\":\"2026-06-15T09:30:00-06:00\",\"resource_ids\":[\"$RID\"]}" "$API/calendars/$CID/bookings")"

echo
echo "== 7. limpieza =="
# borrar reservas del calendario E2E y luego el calendario
for bid in $(curl -s -b "$JADMIN" "$API/calendars/$CID/bookings?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z" | python3 -c "import sys,json;[print(b['booking_id']) for b in json.load(sys.stdin)]"); do
  curl -s -b "$JADMIN" -X DELETE "$API/calendars/$CID/bookings/$bid" -o /dev/null
done
check "DELETE calendario E2E (ya sin reservas) -> 204" 204 "$(code -b "$JADMIN" -X DELETE "$API/calendars/$CID")"
curl -s -b "$JADMIN" -X PATCH -H 'content-type: application/json' --data-raw '{"active":false}' "$API/resources/$RID" -o /dev/null
curl -s -b "$JADMIN" -X PATCH -H 'content-type: application/json' --data-raw '{"active":false}' "$API/resources/$RID2" -o /dev/null

echo
echo "================  PASS=$PASS  FAIL=$FAIL  ================"
[ "$FAIL" -eq 0 ]
