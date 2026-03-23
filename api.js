// api.js — Presence data fetching
// The real API returns: { "data": [{"id":"5","state":"3",...}, ...] }
// State "0" or "1" means the person IS at the lab. Other states mean away.

// Mock: simulates random presence for development/demo
// Replace fetchPresence() with a real fetch() call to your internal API later
async function fetchPresence() {
  // MOCK IMPLEMENTATION - replace with:
  const res = await fetch('http://172.21.214.116/api/osms-api/api/print_state/');
  console.log(res);
  const json = await res.json();
  return json.data;

  // Simulate 13 members with random states
  // ~40% chance of being present (state 0 or 1), ~60% chance of being away
  // const members = [];
  // for (let i = 1; i <= CONFIG.MEMBER_COUNT; i++) {
  //   members.push({
  //     id: String(i),
  //     state: String(
  //       Math.random() < 0.4
  //         ? Math.floor(Math.random() * 2)                // present: "0" or "1"
  //         : 2 + Math.floor(Math.random() * 3)            // away: "2", "3", or "4"
  //     )
  //   });
  // }
  // return members;
}

// Returns true if a member is currently present at the lab
function isPresent(member) {
  return member.state === "0" || member.state === "1";
}
