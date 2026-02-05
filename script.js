// กำหนด URL ของ Google Apps Script Web App
const GAS_URL = "https://script.google.com/macros/s/AKfycby6XGG25-AXbZl9DKF3_LMlvLEG5rLLb8qKX3U_CF3TNGrOQ7WCGGfL_SNcbcI_hgFsMQ/exec";

let cart = [];
let products = [];
let salesHistory = [];

// โหลดข้อมูลเมื่อเปิดหน้า
window.onload = function () {
  loadProducts();
  if (window.location.pathname.includes("history.html")) {
    loadHistory();
  } else if (window.location.pathname.includes("stock.html")) {
    loadStock();
  }
};

// โหลดสินค้าจาก Google Sheets
async function loadProducts() {
  try {
    const res = await fetch(GAS_URL + "?action=getProducts");
    const data = await res.json();
    // ปรับให้อ่านคอลัมน์ "เวลาแก้ไข" (คอลัมน์ที่ 6)
    products = data.map(p => ({
      id: p.id || "-",
      name: p.name || "ไม่มีชื่อ",
      price: parseFloat(p.price) || 0,
      stock: parseInt(p.stock) || 0,
      image: p.image || "",
      lastUpdated: p.lastUpdated || "-" // คอลัมน์ F
    }));
    renderProductList();
  } catch (err) {
    alert("โหลดสินค้าไม่ได้: " + err.message);
  }
}

// แสดงสินค้าในหน้าขาย
function renderProductList() {
  const list = document.getElementById("productList");
  if (!list) return;
  list.innerHTML = "";
  const filter = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  products.forEach(p => {
    const matchesId = p.id.toLowerCase().includes(filter);
    const matchesName = p.name.toLowerCase().includes(filter);
    if (filter === "" || matchesId || matchesName) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${p.image || 'https://via.placeholder.com/40'}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" /></td>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.price}</td>
        <td>${p.stock}</td>
        <td>${p.lastUpdated}</td>
        <td>
          <input 
            type="number" 
            id="qty_${p.id}" 
            value="1" 
            min="1" 
            max="${p.stock}" 
            style="width:60px; margin-bottom:5px;" 
            placeholder="จำนวน"
          >
          <button onclick="addToCart('${p.id}')">เพิ่ม</button>
        </td>
      `;
      list.appendChild(tr);
    }
  });
}

// ค้นหาสินค้า
document.getElementById("searchInput")?.addEventListener("input", renderProductList);

// เพิ่มลงตะกร้า (พร้อมจำนวนที่กำหนด)
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) {
    alert("ไม่พบสินค้า");
    return;
  }
  const qtyInput = document.getElementById(`qty_${id}`);
  let qty = parseInt(qtyInput.value) || 1;
  if (qty <= 0) {
    alert("จำนวนต้องมากกว่า 0");
    qtyInput.value = 1;
    return;
  }
  if (qty > product.stock) {
    alert(`สต็อกเหลือเพียง ${product.stock} ชิ้น`);
    qtyInput.value = product.stock;
    return;
  }
  const item = cart.find(c => c.id === id);
  if (item) {
    const totalInCart = item.qty + qty;
    if (totalInCart > product.stock) {
      alert(`รวมแล้วเกินสต็อก! ซื้อได้สูงสุด ${product.stock - item.qty} ชิ้น`);
      return;
    }
    item.qty = totalInCart;
  } else {
    cart.push({ ...product, qty: qty });
  }
  updateCart();
}

// อัปเดตตะกร้า
function updateCart() {
  const cartItems = document.getElementById("cartItems");
  if (!cartItems) return;
  cartItems.innerHTML = "";
  let total = 0;
  cart.forEach(item => {
    const price = parseFloat(item.price) || 0;
    const subTotal = price * item.qty;
    total += subTotal;
    const div = document.createElement("div");
    div.textContent = `${item.name} x${item.qty} = ${subTotal} บาท`;
    div.innerHTML += ` <button onclick="removeFromCart('${item.id}')">ลบ</button>`;
    cartItems.appendChild(div);
  });
  document.getElementById("total").textContent = total.toFixed(2);
  calculateNet();
}

// ลบจากตะกร้า
function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  updateCart();
}

// คำนวณยอดสุทธิ
function calculateNet() {
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  const discount = parseFloat(document.getElementById("discount").value) || 0;
  const net = Math.max(0, total - discount);
  document.getElementById("netTotal").textContent = net.toFixed(2);
}

document.getElementById("discount")?.addEventListener("input", calculateNet);

// ชำระเงิน
async function checkout() {
  const net = document.getElementById("netTotal").textContent;
  if (cart.length === 0) {
    alert("กรุณาเลือกสินค้าก่อน");
    return;
  }
  const sale = {
    items: cart.map(c => `${c.name} x${c.qty}`),
    total: document.getElementById("total").textContent,
    discount: document.getElementById("discount").value || "0",
    net: net,
    timestamp: new Date().toLocaleString("th-TH")
  };
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "addSale", sale })
    });
    for (const item of cart) {
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "updateStock", id: item.id, qty: -item.qty })
      });
    }
    alert(`ชำระเงินสำเร็จ! ยอดสุทธิ: ${net} บาท`);
    cart = [];
    updateCart();
    document.getElementById("discount").value = "";
    loadProducts();
    if (window.location.pathname.includes("history.html")) {
      loadHistory();
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
}

// =============== หน้าจัดการสต็อก ===============

async function loadStock() {
  try {
    const res = await fetch(GAS_URL + "?action=getProducts");
    const data = await res.json();
    products = data.map(p => ({
      id: p.id || "-",
      name: p.name || "ไม่มีชื่อ",
      price: parseFloat(p.price) || 0,
      stock: parseInt(p.stock) || 0,
      image: p.image || "",
      lastUpdated: p.lastUpdated || "-"
    }));
    renderStockList();
  } catch (err) {
    alert("โหลดสินค้าไม่ได้: " + err.message);
  }
}

function renderStockList() {
  const list = document.getElementById("stockList");
  if (!list) return;
  list.innerHTML = "";
  const filter = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  products.forEach(p => {
    const matchesId = p.id.toLowerCase().includes(filter);
    const matchesName = p.name.toLowerCase().includes(filter);
    if (filter === "" || matchesId || matchesName) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="รูป"><img src="${p.image || 'https://via.placeholder.com/40'}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" /></td>
        <td data-label="รหัส">${p.id}</td>
        <td data-label="ชื่อ">${p.name}</td>
        <td data-label="ราคา">${p.price}</td>
        <td data-label="สต็อก">${p.stock}</td>
        <td data-label="แก้ไขล่าสุด">${p.lastUpdated}</td>
        <td data-label="จัดการ">
          <button onclick="editProduct('${p.id}')">แก้ไข</button>
          <button onclick="deleteProduct('${p.id}')" style="background:red">ลบ</button>
        </td>
      `;
      list.appendChild(tr);
    }
  });
}

// ฟอร์มเพิ่ม/แก้ไข
document.getElementById("productForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();
  const id = document.getElementById("productId").value.trim();
  const name = document.getElementById("productName").value.trim();
  const price = document.getElementById("productPrice").value;
  const stock = document.getElementById("productStock").value;
  const imageInput = document.getElementById("productImage");
  let image = "";

  if (!id || !name || !price || !stock) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  if (imageInput.files.length > 0) {
    const file = imageInput.files[0];
    const reader = new FileReader();
    reader.onload = async function () {
      image = reader.result;
      await saveProductToSheet(id, name, price, stock, image);
    };
    reader.readAsDataURL(file);
  } else {
    await saveProductToSheet(id, name, price, stock, image);
  }
});

async function saveProductToSheet(id, name, price, stock, image) {
  const editId = document.getElementById("editId").value;
  const action = editId ? "updateProduct" : "addProduct";
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action, id, name, price, stock, image })
    });
    alert("บันทึกสำเร็จ");
    clearForm();
    loadStock();
    loadProducts();
  } catch (err) {
    alert("บันทึกไม่ได้: " + err.message);
  }
}

function editProduct(id) {
  const p = products.find(p => p.id === id);
  if (p) {
    document.getElementById("editId").value = id;
    document.getElementById("productId").value = p.id;
    document.getElementById("productName").value = p.name;
    document.getElementById("productPrice").value = p.price;
    document.getElementById("productStock").value = p.stock;
  }
}

function clearForm() {
  document.getElementById("productForm").reset();
  document.getElementById("editId").value = "";
}

async function deleteProduct(id) {
  if (confirm("ลบสินค้านี้หรือไม่?")) {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "deleteProduct", id })
    });
    loadStock();
    loadProducts();
  }
}

// =============== หน้าประวัติการขาย ===============

async function loadHistory() {
  try {
    const res = await fetch(GAS_URL + "?action=getSales");
    salesHistory = await res.json();
    renderHistory();
  } catch (err) {
    alert("โหลดประวัติไม่ได้: " + err.message);
  }
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = "";
  salesHistory.forEach((sale, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="ลำดับ">${i+1}</td>
      <td data-label="รายการ">${sale.items.join(", ")}</td>
      <td data-label="ยอดรวม">${sale.total}</td>
      <td data-label="ส่วนลด">${sale.discount}</td>
      <td data-label="สุทธิ">${sale.net}</td>
      <td data-label="เวลา">${sale.timestamp}</td>
      <td data-label="ลบ"><button onclick="deleteSale(${i})" style="background:red">ลบ</button></td>
    `;
    list.appendChild(tr);
  });
}

async function deleteSale(index) {
  if (confirm("ลบรายการนี้หรือไม่?")) {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "deleteSale", index })
    });
    loadHistory();
  }
}

function printHistory() {
  window.print();
}

function saveHistoryToFile() {
  const dataStr = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(salesHistory, null, 2));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = "sales_history.json";
  a.click();
}

async function deleteAllHistory() {
  if (confirm("ลบประวัติทั้งหมดหรือไม่?")) {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "clearSales" })
    });
    loadHistory();
  }
}