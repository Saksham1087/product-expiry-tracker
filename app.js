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
        const { months, days, totalDays, text } = getTimeRemaining(data.expiry_date);
        products.push({
          id: doc.id,
          product_name: data.product_name,
          batch_number: data.batch_number,
          mfg_date: data.mfg_date,
          expiry_date: data.expiry_date,
          months_left: totalDays / 30,
          badgeText: text,
          inward: data.inward || 0,
          outward: data.outward || 0
        });
      });
      updateDashboard();
      renderTable();
    }, err => {
      console.error('Firestore query error:', err);
    });
}

function getTimeRemaining(expiryDateStr) {
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  expiry.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const totalDays = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  if (totalDays <= 0) {
    return { months: -1, days: 0, totalDays, text: 'Expired' };
  }
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  return { months, days, totalDays, text: `${months} months ${days} days` };
}

function evaluateStockInput(value) {
    if (!value || typeof value !== 'string') return Number(value) || 0;

    const sanitized = value.replace(/\s+/g, '');

    return sanitized.split('+').reduce((total, part) => {
        const num = parseFloat(part);
        return total + (isNaN(num) ? 0 : num);
    }, 0);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getBadgeClass(months) {
  if (months < 0) return 'badge-danger';
  if (months <= 3) return 'badge-warning';
  return 'badge-safe';
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
    productsBody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><p>No products found. Add your first product!</p></div></td></tr>';
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
      <td><span class="badge ${getBadgeClass(p.months_left)}">${p.badgeText}</span></td>
      <td>${p.inward || 0}</td>
      <td>${p.outward || 0}</td>
      <td class="font-bold">${(p.inward || 0) - (p.outward || 0)}</td>
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
    document.getElementById('inward').value = product.inward || 0;
    document.getElementById('outward').value = product.outward || 0;
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
  const inward = evaluateStockInput(document.getElementById('inward').value);
  const outward = evaluateStockInput(document.getElementById('outward').value);
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
        expiry_date,
        inward,
        outward
      });
    } else {
      await db.collection('products').add({
        product_name,
        batch_number,
        mfg_date,
        expiry_date,
        inward,
        outward,
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



document.getElementById('btn-export-json').addEventListener('click', () => {
  const data = JSON.stringify(products, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expiry_tracker_master_backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      imported.forEach(item => {
        if (item.product_name && item.expiry_date) {
          db.collection('products').add({
            product_name: item.product_name,
            batch_number: item.batch_number || '',
            mfg_date: item.mfg_date || '',
            expiry_date: item.expiry_date,
            inward: item.inward || 0,
            outward: item.outward || 0,
            userId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
      alert(`Imported ${imported.length} products successfully.`);
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btn-export-csv').addEventListener('click', () => {
  const headers = ['ID', 'Product Name', 'Batch Number', 'Mfg Date', 'Expiry Date', 'Months Left', 'Inward', 'Outward', 'Balance Stock'];
  const rows = products.map(p => [
    p.id,
    p.product_name,
    p.batch_number,
    formatDate(p.mfg_date),
    formatDate(p.expiry_date),
    p.badgeText,
    p.inward || 0,
    p.outward || 0,
    (p.inward || 0) - (p.outward || 0)
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expiry_tracker_export.csv';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-print-pdf').addEventListener('click', () => {
  window.print();
});


