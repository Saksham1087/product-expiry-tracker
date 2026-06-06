const firebaseConfig = {
  apiKey: "AIzaSyD15QVBLuJx1jEf5LPoxKjbWseb48DXdNE",
  authDomain: "expiry-tracker-platform.firebaseapp.com",
  projectId: "expiry-tracker-platform",
  storageBucket: "expiry-tracker-platform.firebasestorage.app",
  messagingSenderId: "1006265397488",
  appId: "1:1006265397488:web:487d12371453236208d235",
  measurementId: "G-HVK8FSGM3E"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const googleSignInBtn = document.getElementById('googleSignInBtn');
const loginOverlay = document.getElementById('loginOverlay');
const appContainer = document.getElementById('appContainer');
const userProfile = document.getElementById('userProfile');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const productIdInput = document.getElementById('productId');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const modalClose = document.getElementById('modalClose');
const addProductBtn = document.getElementById('addProductBtn');
const formError = document.getElementById('formError');
const productsBody = document.getElementById('productsBody');
const searchInput = document.getElementById('searchInput');
const totalProductsEl = document.getElementById('totalProducts');
const expiringSoonEl = document.getElementById('expiringSoon');

let products = [];
let unsubscribe = null;
let currentUser = null;

googleSignInBtn.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error('Sign-in error:', err);
    alert('Sign-in failed: ' + err.message);
  });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    loginOverlay.classList.remove('active');
    loginOverlay.style.display = 'none';
    appContainer.style.display = 'block';
    userProfile.style.display = 'flex';
    userPhoto.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email;
    startListening();
  } else {
    currentUser = null;
    loginOverlay.classList.add('active');
    loginOverlay.style.display = 'flex';
    appContainer.style.display = 'none';
    userProfile.style.display = 'none';
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    products = [];
    updateDashboard();
    renderTable();
  }
});

function startListening() {
  if (unsubscribe) {
    unsubscribe();
  }
  unsubscribe = db.collection('products')
    .where('userId', '==', currentUser.uid)
    .onSnapshot(snapshot => {
      products = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const today = new Date();
        const monthsLeft = monthsBetween(today, data.expiry_date);
        products.push({
          id: doc.id,
          product_name: data.product_name,
          batch_number: data.batch_number,
          mfg_date: data.mfg_date,
          expiry_date: data.expiry_date,
          months_left: monthsLeft
        });
      });
      updateDashboard();
      renderTable();
    }, err => {
      console.error('Firestore query error:', err);
    });
}

function monthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

function getBadgeClass(months) {
  if (months < 0) return 'badge-danger';
  if (months <= 3) return 'badge-warning';
  return 'badge-safe';
}

function getBadgeLabel(months) {
  if (months < 0) return 'Expired';
  if (months === 0) return 'This month';
  if (months === 1) return '1 month';
  return `${months} months`;
}

function updateDashboard() {
  const total = products.length;
  const expiring = products.filter(p => p.months_left >= 0 && p.months_left < 8.5).length;
  totalProductsEl.textContent = total;
  expiringSoonEl.textContent = expiring;
}

function renderTable(filteredProducts) {
  const data = filteredProducts || products;
  if (data.length === 0) {
    productsBody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No products found. Add your first product!</p></div></td></tr>';
    return;
  }
  productsBody.innerHTML = data.map(p => {
    const rowClass = p.months_left < 8.5 ? 'class="alert-danger-row"' : '';
    const shortId = p.id.length > 8 ? p.id.substring(0, 8) + '...' : p.id;
    return `
    <tr ${rowClass}>
      <td title="${escapeHtml(p.id)}">${escapeHtml(shortId)}</td>
      <td><strong>${escapeHtml(p.product_name)}</strong></td>
      <td>${escapeHtml(p.batch_number)}</td>
      <td>${formatDate(p.mfg_date)}</td>
      <td>${formatDate(p.expiry_date)}</td>
      <td><span class="badge ${getBadgeClass(p.months_left)}">${getBadgeLabel(p.months_left)}</span></td>
      <td>
        <button class="btn btn-edit" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openModal(product = null) {
  formError.classList.remove('visible');
  formError.textContent = '';
  productForm.reset();
  productIdInput.value = '';

  if (product) {
    modalTitle.textContent = 'Edit Product';
    submitBtn.textContent = 'Update Product';
    productIdInput.value = product.id;
    document.getElementById('product_name').value = product.product_name;
    document.getElementById('batch_number').value = product.batch_number;
    document.getElementById('mfg_date').value = product.mfg_date;
    document.getElementById('expiry_date').value = product.expiry_date;
  } else {
    modalTitle.textContent = 'Add Product';
    submitBtn.textContent = 'Save Product';
  }

  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
  formError.classList.remove('visible');
  formError.textContent = '';
}

addProductBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.remove('visible');
  formError.textContent = '';

  const product_name = document.getElementById('product_name').value.trim();
  const batch_number = document.getElementById('batch_number').value.trim();
  const mfg_date = document.getElementById('mfg_date').value;
  const expiry_date = document.getElementById('expiry_date').value;
  const id = productIdInput.value;

  if (!product_name || !batch_number || !mfg_date || !expiry_date) {
    formError.textContent = 'All fields are required.';
    formError.classList.add('visible');
    return;
  }

  const mfgYear = new Date(mfg_date).getFullYear();
  const expYear = new Date(expiry_date).getFullYear();
  if (expYear <= mfgYear) {
    formError.textContent = 'Expiry date must be at least in the calendar year following the manufacturing date.';
    formError.classList.add('visible');
    return;
  }

  try {
    if (id) {
      await db.collection('products').doc(id).update({
        product_name,
        batch_number,
        mfg_date,
        expiry_date
      });
    } else {
      await db.collection('products').add({
        product_name,
        batch_number,
        mfg_date,
        expiry_date,
        userId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    closeModal();
  } catch (err) {
    formError.textContent = err.message || 'Failed to save product.';
    formError.classList.add('visible');
  }
});

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await db.collection('products').doc(id).delete();
  } catch (err) {
    alert('Failed to delete product: ' + err.message);
  }
}

function editProduct(id) {
  const product = products.find(p => p.id === id);
  if (product) openModal(product);
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  if (!q) {
    renderTable();
    return;
  }
  const filtered = products.filter(p =>
    p.product_name.toLowerCase().includes(q) ||
    p.batch_number.toLowerCase().includes(q)
  );
  renderTable(filtered);
});
