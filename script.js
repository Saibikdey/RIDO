// ===============================
// Bengaluru Zones
// ===============================
const ZONES = [
  { name: "Central", areas: ["MG Road", "Indiranagar", "Cubbon"], multiplier: 1.3 },
  { name: "IT Corridor", areas: ["Whitefield", "Electronic City"], multiplier: 1.4 },
  { name: "North", areas: ["Hebbal", "Yelahanka"], multiplier: 1.2 },
  { name: "South", areas: ["Jayanagar", "Banashankari"], multiplier: 1.1 },
];

const BASE_FARE = 600;
const PER_KM = 14;
const PREMIUM_COST = 200;

// ===============================
// DOM ELEMENTS (FIX)
// ===============================
const pickupInput = document.getElementById("pickupInput");
const dropInput = document.getElementById("dropInput");
const pickupSearchBtn = document.getElementById("pickupSearchBtn");
const dropSearchBtn = document.getElementById("dropSearchBtn");
const calculateBtn = document.getElementById("calculateBtn");
const bookBtn = document.getElementById("bookBtn");
const zoneInfo = document.getElementById("zoneInfo");
const fareInfo = document.getElementById("fareInfo");
localStorage.removeItem("rido_user");

// ===============================
// Map Init
// ===============================
let map, pickupMarker, dropMarker, routeLine, carMarker;

map = L.map("map").setView([12.9716, 77.5946], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// ===============================
// Search
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

pickupSearchBtn.onclick = () => searchPlace(pickupInput.value, setPickup);
dropSearchBtn.onclick = () => searchPlace(dropInput.value, setDrop);

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
// Routing
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
// Zone & Traffic
// ===============================
function detectZone(place) {
  for (let z of ZONES) {
    if (z.areas.some(a => place.includes(a))) return z;
  }
  return { name: "Other", multiplier: 1.0 };
}

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

  let fare =
    (BASE_FARE + distanceKm * PER_KM) *
    zone.multiplier *
    trafficMultiplier();

  // Premium cost
  if (document.getElementById("premiumService")?.checked) {
    fare += PREMIUM_COST;
  }

  let discount = 0;
  let finalFare = fare;

  // ✅ DISCOUNT LOGIC
  if (fare > 1000) {
    discount = fare * 0.10; // 10% discount
    finalFare = fare - discount;
  }

  fareInfo.innerHTML = `
    Distance: ${distanceKm.toFixed(2)} km<br>
    Time: ${Math.round(timeMin)} min<br>
    Premium: ${document.getElementById("premiumService")?.checked ? "Yes (+₹200)" : "No"}<br>
    Fare before discount: ₹${fare.toFixed(0)}<br>
    ${
      discount > 0
        ? `Discount (10%): -₹${discount.toFixed(0)}<br>
           <strong>Total Payable: ₹${finalFare.toFixed(0)}</strong>`
        : `<strong>Total Payable: ₹${finalFare.toFixed(0)}</strong>`
    }
  `;

  bookBtn.disabled = false;
}

calculateBtn.onclick = () => {
  if (!pickupMarker || !dropMarker) return alert("Select pickup & drop");
  calculateRoute();
};

// ===============================
// LOGIN
// ===============================
const loginModal = document.getElementById("loginModal");
const paymentModal = document.getElementById("paymentModal");
const feedbackModal = document.getElementById("feedbackModal");

function isLoggedIn() {
  return localStorage.getItem("rido_user") === "loggedin";
}

loginBtn.onclick = () => {
  const email = document.getElementById("loginEmail").value.trim();
  const phone = document.getElementById("loginPhone").value.trim();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[6-9]\d{9}$/;

  if (!emailPattern.test(email)) {
    alert("Enter valid email");
    return;
  }
  if (!phonePattern.test(phone)) {
    alert("Enter valid phone number");
    return;
  }

  localStorage.setItem("rido_email", email);
  localStorage.setItem("rido_phone", phone);
  localStorage.setItem("rido_user", "loggedin");

  loginModal.classList.add("hidden");
  alert("Login successful");

};

// ===============================
// BOOK CAB
// ===============================
bookBtn.onclick = () => {
  if (!isLoggedIn()) {
    loginModal.classList.remove("hidden");
    return;
  }
  startRide();
};

// ===============================
// CAB ANIMATION
// ===============================
function startRide() {
  const pts = routeLine.getLatLngs();
  let i = 0;

  carMarker?.remove();
  carMarker = L.marker(pts[0]).addTo(map);

  const anim = setInterval(() => {
    i++;
    if (i >= pts.length) {
      clearInterval(anim);
      paymentModal.classList.remove("hidden"); // show payment after ride
      return;
    }
    carMarker.setLatLng(pts[i]);
  }, 40);

  bookBtn.textContent = "Ride in progress 🚗";
  bookBtn.disabled = true;
}

// ===============================
// PAYMENT
// ===============================
function pay(method) {
  paymentModal.classList.add("hidden");

  // Auto-fill feedback with stored email & phone
  document.getElementById("fbEmail").value = localStorage.getItem("rido_email");
  document.getElementById("fbPhone").value = localStorage.getItem("rido_phone");

  feedbackModal.classList.remove("hidden");
  alert(`Payment successful via ${method}`);
}

// ===============================
// FEEDBACK
// ===============================
function submitFeedback() {
  const feedback = document.getElementById("feedbackText").value.trim();
  if (!feedback) return alert("Please enter your feedback");

  // Save feedback in localStorage
  const allFeedback = JSON.parse(localStorage.getItem("rido_feedback") || "[]");
  allFeedback.push({ feedback, time: new Date().toISOString() });
  localStorage.setItem("rido_feedback", JSON.stringify(allFeedback));

  alert("Thank you for your feedback 😊");

  feedbackModal.classList.add("hidden");
  document.getElementById("feedbackText").value = "";
  document.getElementById("rating").value = "";
}

// ===============================
// UTILITIES
// ===============================
function closeLogin() { loginModal.classList.add("hidden"); }
function closePayment() { paymentModal.classList.add("hidden"); }
function toggleFare() { document.querySelector(".fare-card").classList.toggle("hidden"); }
function clearForm() {
  pickupInput.value = "";
  dropInput.value = "";
  pickupMarker?.remove();
  dropMarker?.remove();
  routeLine?.remove();
  bookBtn.disabled = true;
  alert("Thank you for using Rido 🚗😊");
}

function loadFeedbackUser() {
  document.getElementById("fbEmail").value = localStorage.getItem("rido_email") || "";
  document.getElementById("fbPhone").value = localStorage.getItem("rido_phone") || "";
}
