const API_URL = "http://127.0.0.1:8000";

function showAlert(message, type) {
    const alertBox = document.getElementById("alert-box");
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = "block";
}

document.getElementById("login-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    // الـ FastAPI عادة بياخد الـ username في الـ OAuth2PasswordRequestForm، فبنبعت الـ email مكانه لو الباك إند عندك بيستقبل الإيميل كـ username
    const formData = new URLSearchParams();
    formData.append("username", email); // إرسال الإيميل في حقل الـ username للـ API
    formData.append("password", password);

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("token", data.access_token);
            showAlert("تم تسجيل الدخول بنجاح! جاري توجيهك...", "success");
            setTimeout(() => window.location.href = "../../html/dashboard/dashboard.html", 1500);
        } else {
            showAlert(data.detail || "خطأ في بيانات الدخول", "error");
        }
    } catch (err) {
        showAlert("تعذر الاتصال بالسيرفر", "error");
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const successMsg = localStorage.getItem("login_success_msg");
    if (successMsg) {
        const alertBox = document.getElementById("alert-box"); // أو الـ ID الخاص بالتنبيه عندك في صفحة اللوجين
        if (alertBox) {
            alertBox.textContent = successMsg;
            alertBox.className = "alert success";
            alertBox.style.display = "block";
        }
        // مسح الرسالة كي لا تظهر عند تحديث صفحة اللوجين لاحقاً
        localStorage.removeItem("login_success_msg");
    }
});