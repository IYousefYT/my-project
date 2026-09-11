const API_URL = "http://127.0.0.1:8000";

function showAlert(message, type) {
    const alertBox = document.getElementById("alert-box");
    if (!alertBox) return;
    
    if (typeof message === "object") {
        message = message.detail || JSON.stringify(message);
    }
    
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("register-form");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
        // لا توجد preventDefault، دع الصفحة تتصرف بشكل طبيعي أو تحكم بالأمر يدوياً
        e.preventDefault(); 

        const username = document.getElementById("reg-username").value.trim();
        const nickname = document.getElementById("reg-nickname").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value.trim();
        
        if (!username || !email || !password) {
            showAlert("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        const payload = { username, nickname, email, password, role: "client" };

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok) {
                // حفظ رسالة النجاح في الذاكرة المؤقتة لنقلها لصفحة الدخول
                localStorage.setItem("login_success_msg", "تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.");
                
                // تحويل فوري لصفحة اللوجิน مع حدوث الـ Refresh الطبيعي
                window.location.href = "./login.html";
            } else {
                let errorMsg = "خطأ في إنشاء الحساب";
                if (data.detail) {
                    errorMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
                }
                showAlert(errorMsg, "error");
            }
        } catch (err) {
            showAlert("تعذر الاتصال بالسيرفر", "error");
        }
    });
});