const API_URL = "http://127.0.0.1:8000";

async function fetchHomeData() {
    // جلب الألعاب
    try {
        const gamesRes = await fetch(`${API_URL}/games`);
        if (gamesRes.ok) {
            const games = await gamesRes.json();
            const gamesGrid = document.getElementById("games-grid");
            gamesGrid.innerHTML = "";

            if (games.length === 0) {
                gamesGrid.innerHTML = `<p class="loading-text">لا توجد ألعاب متاحة حالياً.</p>`;
            } else {
                games.forEach(game => {
                    const title = game.title || "لعبة بدون اسم";
                    // استخدام الوصف القادم من قاعدة البيانات، ولو مش موجود نعرض وصف احترافي
                    const description = (game.description && game.description !== "games") 
                        ? game.description 
                        : "أقوى خدمات وشحن وتطوير الحسابات لهذه اللعبة.";
                    const imageUrl = game.image_url || "";

                    gamesGrid.innerHTML += `
                        <div class="card">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${title}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">` : ''}
                            <h3>${title}</h3>
                            <p>${description}</p>
                        </div>
                    `;
                });
            }
        }
    } catch (err) {
        document.getElementById("games-grid").innerHTML = `<p class="loading-text" style="color:#ef4444;">تعذر تحميل الألعاب من السيرفر.</p>`;
    }

    // جلب الخدمات
    try {
        const servicesRes = await fetch(`${API_URL}/services`);
        if (servicesRes.ok) {
            const services = await servicesRes.json();
            const servicesGrid = document.getElementById("services-grid");
            servicesGrid.innerHTML = "";

            if (services.length === 0) {
                servicesGrid.innerHTML = `<p class="loading-text">لا توجد خدمات متاحة حالياً.</p>`;
            } else {
                services.forEach(service => {
                    const title = service.title || service.name || "خدمة بدون اسم";
                    const description = service.description || "خدمة ممتازة وبأسعار تنافسية.";
                    const price = service.price !== undefined ? service.price : "0";

                    servicesGrid.innerHTML += `
                        <div class="card">
                            <h3>${title}</h3>
                            <p>${description}</p>
                            <span style="display:inline-block; margin-top:12px; font-weight:700; color:var(--primary-color);">${price} $</span>
                        </div>
                    `;
                });
            }
        }
    } catch (err) {
        document.getElementById("services-grid").innerHTML = `<p class="loading-text" style="color:#ef4444;">تعذر تحميل الخدمات من السيرفر.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // 1. تشغيل جلب البيانات للألعاب والخدمات
    fetchHomeData();

    // 2. التحكم بالقائمة الجانبية للموبايل
    const menuToggleBtn = document.getElementById("menu-toggle-btn");
    const mobileDrawer = document.getElementById("mobileDrawer");
    const closeDrawerBtn = document.getElementById("closeDrawerBtn");
    const menuOverlay = document.getElementById("menuOverlay");

    if (menuToggleBtn && mobileDrawer) {
        menuToggleBtn.addEventListener("click", () => {
            mobileDrawer.classList.add("open");
            if (menuOverlay) menuOverlay.classList.add("active");
        });

        const closeMenu = () => {
            mobileDrawer.classList.remove("open");
            if (menuOverlay) menuOverlay.classList.remove("active");
        };

        if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", closeMenu);
        if (menuOverlay) menuOverlay.addEventListener("click", closeMenu);

        // إغلاق القائمة عند الضغط على أي رابط جواها
        mobileDrawer.addEventListener("click", (e) => {
            if (e.target.tagName === "A") {
                closeMenu();
            }
        });
    }

    // 3. التحقق من حالة تسجيل الدخول وتحديث الواجهات
    const token = localStorage.getItem("token");
    const navAuthContainer = document.getElementById("nav-auth-container");
    const mobileAuthContainer = document.getElementById("mobile-auth-container");
    const footerAuthSection = document.getElementById("footer-auth-section");

    // وظيفة تسجيل الخروج الموحدة
    const handleLogout = (e) => {
        e.preventDefault();
        localStorage.removeItem("token");
        window.location.reload();
    };

    if (!token) return; // لو مش مسجل دخول، سيب الأزرار الافتراضية زي ما هي

    try {
        const res = await fetch(`${API_URL}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Unauthorized");
        const user = await res.json();

        // قالب البروفايل للديسكتوب مع زر الخروج المزين بالأيقونة الحمراء
        const desktopProfileHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <a href="html/dashboard/dashboard.html" class="user-profile-badge" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: #fff; background: #161925; padding: 6px 12px; border-radius: 20px; border: 1px solid #232738;">
                    <span style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #232738; font-size: 14px;">
                        ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : '👤'}
                    </span>
                    <span style="font-size: 14px; font-weight: 600;">${user.nickname || user.username}</span>
                </a>
                <a href="#" id="desktop-logout-btn" title="تسجيل الخروج" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 50%; text-decoration: none; color: #ef4444; transition: 0.3s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444';">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </a>
            </div>
        `;

        // قالب البروفايل وتسجيل الخروج لقائمة الموبايل
        const mobileProfileHTML = `
            <a href="html/dashboard/dashboard.html" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: #fff; background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
                <span style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #232738; font-size: 16px;">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : '👤'}
                </span>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 14px; font-weight: 600;">${user.nickname || user.username}</span>
                    <span style="font-size: 11px; color: #a0aec0;">لوحة التحكم</span>
                </div>
            </a>
            <a href="#" id="mobile-logout-btn" style="text-align: center; padding: 10px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid rgba(239, 68, 68, 0.2);">تسجيل الخروج</a>
        `;

        if (navAuthContainer) navAuthContainer.innerHTML = desktopProfileHTML;
        if (mobileAuthContainer) mobileAuthContainer.innerHTML = mobileProfileHTML;

        // تفعيل أزرار تسجيل الخروج للديسكتوب والموبايل
        const desktopLogoutBtn = document.getElementById("desktop-logout-btn");
        if (desktopLogoutBtn) desktopLogoutBtn.addEventListener("click", handleLogout);

        const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
        if (mobileLogoutBtn) mobileLogoutBtn.addEventListener("click", handleLogout);

        // تحديث الـ Footer
        if (footerAuthSection) {
            footerAuthSection.innerHTML = `
                <h3>حسابي</h3>
                <ul>
                    <li><a href="html/dashboard/dashboard.html">لوحة التحكم / البروفايل</a></li>
                    <li><a href="#" id="footer-logout-btn" style="color: #ef4444;">تسجيل الخروج</a></li>
                </ul>
            `;
            const footerLogoutBtn = document.getElementById("footer-logout-btn");
            if (footerLogoutBtn) footerLogoutBtn.addEventListener("click", handleLogout);
        }

    } catch (err) {
        localStorage.removeItem("token");
    }
});