// ===============================
// Bengaluru Zones
// ===============================
const ZONES = [
  { name: "Central", areas: ["MG Road", "Indiranagar", "Cubbon"], multiplier: 1.3 },
  { name: "IT Corridor", areas: ["Whitefield", "Electronic City"], multiplier: 1.4 },
  { name: "North", areas: ["Hebbal", "Yelahanka"], multiplier: 1.2 },
  { name: "South", areas: ["Jayanagar", "Banashankari"], multiplier: 1.1 },
];

const BASE_FARE = 60;
const PER_KM = 14;

// ===============================
// Map Init
// ===============================
let map, pickupMarker, dropMarker, routeLine, carMarker;

map = L.map("map").setView([12.9716, 77.5946], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// ===============================
// Search (Better Search UX)
// ===============================
function searchPlace(query, cb) {
  if (!query.trim()) return alert("Enter a location");

  fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query + ", Bengaluru"
    )}&limit=1`
  )
    .then(res => res.json())
    .then(d => {
      if (!d.length) return alert("Location not found in Bengaluru");
      cb(+d[0].lat, +d[0].lon, d[0].display_name);
    });
}

pickupSearchBtn.onclick = () =>
  searchPlace(pickupInput.value, setPickup);

dropSearchBtn.onclick = () =>
  searchPlace(dropInput.value, setDrop);

// ===============================
// Pickup / Drop
// ===============================
function setPickup(lat, lng, name) {
  pickupMarker?.remove();
  pickupMarker = L.marker([lat, lng]).addTo(map);
  pickupInput.value = name;
}

function setDrop(lat, lng, name) {
  dropMarker?.remove();
  dropMarker = L.marker([lat, lng]).addTo(map);
  dropInput.value = name;
}

// ===============================
// OSRM Road Routing
// ===============================
function calculateRoute() {
  const p = pickupMarker.getLatLng();
  const d = dropMarker.getLatLng();

  fetch(
    `https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`
  )
    .then(res => res.json())
    .then(data => {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLine?.remove();
      routeLine = L.polyline(coords, { color: "#fff", weight: 4 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      calculateFare(route.distance / 1000, route.duration / 60);
    });
}

// ===============================
// Zone Detection
// ===============================
function detectZone(place) {
  for (let z of ZONES) {
    if (z.areas.some(a => place.includes(a))) return z;
  }
  return { name: "Other", multiplier: 1.0 };
}

// ===============================
// Traffic Pricing
// ===============================
function trafficMultiplier() {
  const h = new Date().getHours();
  return (h >= 8 && h <= 11) || (h >= 17 && h <= 21) ? 1.5 : 1.0;
}

// ===============================
// Fare Calculation
// ===============================
function calculateFare(distanceKm, timeMin) {
  const zone = detectZone(pickupInput.value);
  zoneInfo.textContent = `Zone: ${zone.name}`;

  const fare =
    (BASE_FARE + distanceKm * PER_KM) *
    zone.multiplier *
    trafficMultiplier();

  fareInfo.innerHTML = `
    Distance: ${distanceKm.toFixed(2)} km<br>
    Time: ${Math.round(timeMin)} min<br>
    Cab base: ₹${BASE_FARE}<br>
    Zone x${zone.multiplier}<br>
    Traffic surge applied<br>
    <strong>Total: ₹${fare.toFixed(0)}</strong>
  `;

  bookBtn.disabled = false;
}

calculateBtn.onclick = () => {
  if (!pickupMarker || !dropMarker) return alert("Select pickup & drop");
  calculateRoute();
};

// ===============================
// LOGIN + PAYMENT
// ===============================
const loginModal = document.getElementById("loginModal");
const paymentModal = document.getElementById("paymentModal");

function isLoggedIn() {
  return localStorage.getItem("rido_user");
}

document.getElementById("loginBtn").onclick = () => {
  const val = document.getElementById("loginInput").value;
  if (!val) return alert("Enter phone or email");

  localStorage.setItem("rido_user", val);
  loginModal.classList.add("hidden");
  alert("Login successful. Book your ride 🚗");
};

function pay(method) {
  paymentModal.classList.add("hidden");
  alert(`Payment successful via ${method} 🚗`);
}

function closeLogin() {
  loginModal.classList.add("hidden");
}

function closePayment() {
  paymentModal.classList.add("hidden");
}

// ===============================
// CAB ANIMATION + PAYMENT AFTER DESTINATION
// ===============================
function startRide() {
  const pts = routeLine.getLatLngs();
  let i = 0;

  carMarker?.remove();
  carMarker = L.marker(pts[0], { title: "Your cab 🚗" }).addTo(map);

  const anim = setInterval(() => {
    i++;

    if (i >= pts.length) {
      clearInterval(anim);
      paymentModal.classList.remove("hidden"); // payment AFTER ride
      return;
    }

    carMarker.setLatLng(pts[i]);
  }, 40);

  bookBtn.textContent = "Ride in progress 🚗";
  bookBtn.disabled = true;
}

// ===============================
// BOOK BUTTON (LOGIN BEFORE RIDE)
// ===============================
bookBtn.onclick = () => {
  if (!isLoggedIn()) {
    loginModal.classList.remove("hidden");
    return;
  }

  startRide();
};
