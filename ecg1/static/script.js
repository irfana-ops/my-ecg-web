

document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Configuration ---
    const SUPABASE_URL = "https://kjkztdgbkolfsekssheb.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqa3p0ZGdia29sZnNla3NzaGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODQ4NjQsImV4cCI6MjA4ODM2MDg2NH0.y01Avf74SaFg-z6KohdyH7N6e7rG2beCIGeD3g96NIM";

    // Use a different variable name to avoid conflict with the global 'supabase' object
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- Authentication State Management ---
    let currentUser = null;

    _supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();
        if (event === 'SIGNED_IN' && (window.location.pathname === '/login' || window.location.pathname === '/signup')) {
            window.location.href = '/dashboard';
        }

        // Trigger dashboard history load once we confirm the user is logged in
        if (window.location.pathname === '/dashboard' && currentUser) {
            // We use a custom event or directly call it if it's available, 
            // but loadHistory is scoped inside dashboard logic. 
            // We can dispatch a custom event.
            document.dispatchEvent(new CustomEvent('auth-ready'));
        }
    });

    function updateAuthUI() {
        const navLinks = document.getElementById('nav-links');
        const navLogin = document.getElementById('nav-login');
        const navSignup = document.getElementById('nav-signup');
        const userMenu = document.getElementById('user-menu');
        const userDisplayName = document.getElementById('user-display-name');

        if (currentUser) {
            if (navLogin) navLogin.classList.add('hidden');
            if (navSignup) navSignup.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (userDisplayName) userDisplayName.textContent = currentUser.user_metadata.full_name || currentUser.email;
        } else {
            if (navLogin) navLogin.classList.remove('hidden');
            if (navSignup) navSignup.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    }

    // --- Auth Handlers ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('btn-login');
            const errorDiv = document.getElementById('auth-error');

            setLoading(btn, true);
            const { error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) {
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
                setLoading(btn, false);
            }
        });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('full-name').value;
            const btn = document.getElementById('btn-signup');
            const errorDiv = document.getElementById('auth-error');

            setLoading(btn, true);
            const { error } = await _supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });
            if (error) {
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
                setLoading(btn, false);
            } else {
                alert('Verification email sent! Please check your inbox.');
                window.location.href = '/login';
            }
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await _supabase.auth.signOut();
            window.location.href = '/';
        });
    }

    function setLoading(btn, isLoading) {
        const text = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-small');
        if (isLoading) {
            text.classList.add('hidden');
            spinner.classList.remove('hidden');
            btn.disabled = true;
        } else {
            text.classList.remove('hidden');
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    }

    // --- Upload Page Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const validationMsg = document.getElementById('validation-msg');
    const previewSection = document.getElementById('preview-section');
    const imagePreview = document.getElementById('image-preview');
    const btnRemove = document.getElementById('btn-remove');
    const btnProceed = document.getElementById('btn-proceed');

    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingSpinner = document.getElementById('loading-spinner');

    const districtSelect = document.getElementById('district-select');
    const coordsDisplay = document.getElementById('selected-coords-display');

    // Force fresh location selection on every page load
    if (dropZone) {
        localStorage.removeItem('user_district');
        if (districtSelect) districtSelect.value = "";
        if (btnProceed) btnProceed.disabled = true;
    }

    let selectedFile = null;

    // --- Dummy Kerala Data Mapping ---
    const keralaData = {
        "Alappuzha": {
            aqi: 38,
            message: "Good: Air quality is satisfactory. Enjoy the backwaters!",
            hospitals: [
                { name: "Sahrudaya Cardiac Centre", phone: "0478 281 3131" },
                { name: "TD Medical College (Cardiology)", phone: "0477 228 2015" }
            ]
        },
        "Ernakulam": {
            aqi: 72,
            message: "Moderate: Sensitive individuals should limit outdoor exertion.",
            hospitals: [
                { name: "Amrita Institute of Medical Sciences (Cardiology)", phone: "0484 280 1234" },
                { name: "Lourdes Heart Institute", phone: "0484 412 3456" },
                { name: "Aster Medcity Cardiac Sciences", phone: "0484 669 9999" }
            ]
        },
        "Idukki": {
            aqi: 25,
            message: "Excellent: Perfect time for high-altitude walks.",
            hospitals: [
                { name: "St. John's Hospital (Cardiac Care)", phone: "04863 222 222" },
                { name: "Idukki District Hospital Cardiology Unit", phone: "04862 232 245" }
            ]
        },
        "Kannur": {
            aqi: 45,
            message: "Good: Enjoy the coastal breeze.",
            hospitals: [
                { name: "AKG Memorial Cooperative Hospital (Cardiology)", phone: "0497 270 1311" },
                { name: "Kannur Medical College (Cardiac Dept)", phone: "0497 285 5000" }
            ]
        },
        "Kasaragod": {
            aqi: 32,
            message: "Good: Air is clean and fresh.",
            hospitals: [
                { name: "Kasaragod Institute of Medical Sciences", phone: "04994 220 000" },
                { name: "Malabar Cardiac Centre (Unit II)", phone: "04994 231 456" }
            ]
        },
        "Kollam": {
            aqi: 54,
            message: "Moderate: Acceptable air quality.",
            hospitals: [
                { name: "N.S. Memorial Institute of Medical Sciences (Cardiology)", phone: "0474 272 3191" },
                { name: "Bishop Benziger Hospital (Heart Centre)", phone: "0474 274 8181" }
            ]
        },
        "Kottayam": {
            aqi: 48,
            message: "Good: Great time to visit the hills.",
            hospitals: [
                { name: "Caritas Hospital Heart Institute", phone: "0481 279 0025" },
                { name: "Kottayam Medical College (Cardiology Dept)", phone: "0481 257 3251" },
                { name: "MGM Muthoot Heart Institute", phone: "0481 256 0864" }
            ]
        },
        "Kozhikode": {
            aqi: 65,
            message: "Moderate: Mostly fine, sensitive groups take care.",
            hospitals: [
                { name: "Baby Memorial Hospital (Cardiac Centre)", phone: "0495 272 3272" },
                { name: "MIMS Cardiac Sciences", phone: "0495 248 8000" },
                { name: "Calicut Medical College Super Speciality (Cardio)", phone: "0495 235 0212" }
            ]
        },
        "Malappuram": {
            aqi: 52,
            message: "Moderate: Normal outdoors today.",
            hospitals: [
                { name: "Moulana Hospital (Cardiology Unit)", phone: "0483 273 0000" },
                { name: "MES Medical College Cardiology", phone: "04933 298 300" }
            ]
        },
        "Palakkad": {
            aqi: 58,
            message: "Moderate: Slightly dry air today.",
            hospitals: [
                { name: "Lakshmi Hospital (Cardiac Care)", phone: "0491 253 9130" },
                { name: "Ahalia Heart Foundation", phone: "04923 235 888" }
            ]
        },
        "Pathanamthitta": {
            aqi: 35,
            message: "Good: Healthy air for outdoor activities.",
            hospitals: [
                { name: "Muthoot Heart Centre", phone: "0468 222 2222" },
                { name: "Pushpagiri Heart Institute", phone: "0469 270 0755" }
            ]
        },
        "Thiruvananthapuram": {
            aqi: 68,
            message: "Moderate: Urban air levels, generally okay.",
            hospitals: [
                { name: "Sree Chitra Tirunal Institute (SCTIMST)", phone: "0471 244 3152" },
                { name: "PRS Hospital Cardiac Centre", phone: "0471 234 4443" },
                { name: "KIMS Cancer & Heart Institute", phone: "0471 304 1000" }
            ]
        },
        "Thrissur": {
            aqi: 62,
            message: "Moderate: Take standard precautions.",
            hospitals: [
                { name: "Jubilee Mission Medical College (Cardiology)", phone: "0487 243 2200" },
                { name: "West Fort Hi-Tech Heart Institute", phone: "0487 238 2382" }
            ]
        },
        "Wayanad": {
            aqi: 18,
            message: "Excellent: Cleanest air in the state. Breath deep!",
            hospitals: [
                { name: "Wayanad District Hospital (Cardiac Clinic)", phone: "04936 220 252" },
                { name: "DM WIMS Heart Centre", phone: "04936 287 000" }
            ]
        }
    };

    if (dropZone) {
        // Handle District selection
        if (districtSelect) {
            districtSelect.addEventListener('change', (e) => {
                const district = e.target.value;
                if (district && keralaData[district]) {
                    localStorage.setItem('user_district', district);
                    if (coordsDisplay) {
                        coordsDisplay.textContent = `✅ Selected: ${district}`;
                        coordsDisplay.classList.remove('hidden');
                    }
                    if (selectedFile) btnProceed.disabled = false;
                } else {
                    localStorage.removeItem('user_district');
                    if (coordsDisplay) coordsDisplay.classList.add('hidden');
                    btnProceed.disabled = true;
                }
            });
        }

        // Drag & Drop Handlers
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFileSelection(e.dataTransfer.files[0]);
        });

        dropZone.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') fileInput.click(); });
        fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelection(e.target.files[0]); });

        btnRemove.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            previewSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
            hideError();
            btnProceed.disabled = true;
        });

        btnProceed.addEventListener('click', () => {
            if (!selectedFile || !localStorage.getItem('user_district')) return;

            btnProceed.disabled = true;
            btnRemove.classList.add('hidden');
            progressContainer.classList.remove('hidden');
            loadingSpinner.classList.remove('hidden');
            hideError();

            const formData = new FormData();
            formData.append('file', selectedFile);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload', true);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.floor((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = percentComplete + '%';
                }
            };

            xhr.onload = function () {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        localStorage.setItem('ecg_filename', response.filename || selectedFile.name);
                        setTimeout(() => { window.location.href = '/process'; }, 500);
                    } else {
                        showError(response.error || 'Upload failed');
                        resetUploadUI();
                    }
                } else {
                    showError('Server error during upload.');
                    resetUploadUI();
                }
            };
            xhr.send(formData);
        });
    }

    function handleFileSelection(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) { showError('Invalid file type.'); return; }
        hideError();
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            dropZone.classList.add('hidden');
            previewSection.classList.remove('hidden');

            // Strictly enforce location selection
            if (localStorage.getItem('user_district')) {
                btnProceed.disabled = false;
            } else {
                btnProceed.disabled = true;
            }
        };
        reader.readAsDataURL(file);
    }

    function showError(msg) { if (validationMsg) { validationMsg.textContent = msg; validationMsg.classList.remove('hidden'); } }
    function hideError() { if (validationMsg) validationMsg.classList.add('hidden'); }
    function resetUploadUI() {
        if (localStorage.getItem('user_district') && selectedFile) {
            btnProceed.disabled = false;
        } else {
            btnProceed.disabled = true;
        }
        btnRemove.classList.remove('hidden');
        progressContainer.classList.add('hidden');
        loadingSpinner.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
    }

    // --- Dashboard Logic ---
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
        const loader = document.getElementById('loader-container');
        const alertPanel = document.getElementById('alert-panel');
        const alertMessage = document.getElementById('alert-message');
        const metricHr = document.getElementById('val-hr');
        const metricStress = document.getElementById('val-stress');
        const metricCondition = document.getElementById('val-condition');
        const recommendationText = document.getElementById('val-recommendation');
        const btnResetZoom = document.getElementById('reset-zoom');
        const hospitalList = document.getElementById('hospital-list');
        const aqiValue = document.getElementById('aqi-value');
        const aqiMessage = document.getElementById('aqi-message');
        const intelligentFeatures = document.getElementById('intelligent-features');

        let ecgChart = null;
        const filename = localStorage.getItem('ecg_filename');
        let latestAnalysis = null;

        // If we are on the /process page but no file, redirect back.
        // If we are on /dashboard, we don't strictly need a filename.
        const isProcessPage = window.location.pathname === '/process';
        const isDashboardPage = window.location.pathname === '/dashboard';

        if (isProcessPage && !filename) {
            window.location.href = '/';
            return;
        }

        if (isProcessPage) {
            fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filename })
            })
                .then(res => res.json())
                .then(async data => {
                    if (data.success) {
                        latestAnalysis = data;
                        renderDashboard(data);
                    } else {
                        alert('Analysis failed: ' + data.error);
                        window.location.href = '/';
                    }
                });
        } else if (isDashboardPage) {
            // We are just viewing the dashboard history
            if (loader) loader.classList.add('hidden');
            if (dashboardContainer) dashboardContainer.classList.remove('hidden');
        }

        function renderDashboard(data) {
            const analysis = data.analysis;
            loader.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');

            metricHr.textContent = analysis.heart_rate;

            // Set text & style for Stress Level
            metricStress.textContent = analysis.stress_level;
            metricStress.className = 'status-pill status-' + (analysis.stress_level === 'Low' ? 'normal' : 'critical');

            // Set text & style for Condition
            metricCondition.textContent = analysis.abnormality;
            metricCondition.className = 'status-pill status-' + (analysis.stress_level === 'Low' ? 'normal' : 'critical');

            recommendationText.textContent = analysis.recommendation;


            // Show alert box ONLY if stress is High
            if (analysis.stress_level !== 'Low') {
                alertPanel.classList.remove('hidden');
                alertMessage.textContent = analysis.recommendation;

                const district = localStorage.getItem('user_district');
                if (district && keralaData[district]) {
                    displayDummyFeatures(district);
                }
            }
            renderChart(data.signal);
        }

        function renderChart(signalData) {
            const ctx = document.getElementById('ecgChart').getContext('2d');
            const labels = Array.from({ length: signalData.length }, (_, i) => (i * 10).toFixed(0));
            ecgChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'ECG Signal (mV)',
                        data: signalData,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { display: false }, y: { beginAtZero: false } }
                }
            });
            if (btnResetZoom) btnResetZoom.addEventListener('click', () => ecgChart.resetZoom());
        }

        function displayDummyFeatures(district) {
            if (intelligentFeatures) intelligentFeatures.classList.remove('hidden');
            const data = keralaData[district];

            if (aqiValue) aqiValue.textContent = data.aqi;
            if (aqiMessage) aqiMessage.textContent = data.message;

            if (hospitalList) {
                let html = '';
                data.hospitals.forEach(h => {
                    html += `
                    <div class="metric-item" style="border-bottom: 1px solid #fee2e2; padding: 0.8rem 0;">
                        <div class="metric-info">
                            <span class="metric-label" style="color: #9f1239; font-weight: 600; font-size: 1rem;">${h.name}</span>
                            <div class="metric-value-container">
                                <span class="metric-unit" style="font-size: 0.85rem; color: #e11d48; background: #fff1f2; padding: 2px 8px; border-radius: 4px; border: 1px solid #fecdd3;">📞 ${h.phone}</span>
                            </div>
                        </div>
                    </div>`;
                });
                hospitalList.innerHTML = html;
            }
        }

        // PDF Generation
        const btnDownloadPdf = document.getElementById('btn-download-pdf');
        if (btnDownloadPdf) {
            btnDownloadPdf.addEventListener('click', () => {
                if (!latestAnalysis) return;
                const chartImage = document.getElementById('ecgChart').toDataURL('image/png');
                const patientData = {
                    name: document.getElementById('patient-name').value || 'N/A',
                    age: document.getElementById('patient-age').value || 'N/A',
                    gender: document.getElementById('patient-gender').value || 'N/A'
                };
                fetch('/generate-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patient: patientData,
                        analysis: latestAnalysis.analysis, // Pass the inner analysis object
                        is_multi_lead: latestAnalysis.is_multi_lead,
                        cropped_preview: latestAnalysis.cropped_preview,
                        chartImage: chartImage
                    })
                })
                    .then(async res => {
                        if (!res.ok) {
                            const errorData = await res.json().catch(() => ({}));
                            throw new Error(errorData.error || 'PDF Generation failed');
                        }
                        return res.blob();
                    })
                    .then(async blob => {
                        // Save to history on button click
                        const { data: { session } } = await _supabase.auth.getSession();
                        let savedToHistory = false;
                        if (session && session.user) {
                            savedToHistory = await saveReportToSupabase(latestAnalysis.analysis, patientData, session.user.id);
                            if (savedToHistory) {
                                // Instantly reload history so it drops into the top of the UI
                                loadHistory();
                            }
                        }

                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `ECG_Report_${new Date().getTime()}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);

                        if (savedToHistory) {
                            alert('Success! Your report has been saved to your Dashboard History and downloaded.');
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        alert('Error generating PDF: ' + err.message);
                    });
            });
        }

        async function saveReportToSupabase(analysis, patient, userId) {
            console.log("Saving report for user:", userId);
            const { data, error } = await _supabase
                .from('reports')
                .insert([
                    {
                        user_id: userId,
                        patient_name: patient.name,
                        heart_rate: analysis.heart_rate,
                        abnormality: analysis.abnormality,
                        stress_level: analysis.stress_level,
                        district: localStorage.getItem('user_district') || null,
                        created_at: new Date().toISOString()
                    }
                ]);
            if (error) {
                console.error('Error saving report:', error);
                return false;
            }
            return true;
        }

        async function loadHistory() {
            const historyList = document.getElementById('history-list');
            if (!historyList) return;

            const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
            if (sessionError || !session) {
                console.log("User not logged in, cannot load history");
                historyList.innerHTML = '<p class="error-text">Please log in to view history.</p>';
                return;
            }

            try {
                const { data, error } = await _supabase
                    .from('reports')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    historyList.innerHTML = `<p class="error-text">Error loading history: ${error.message}</p>`;
                    return;
                }

                if (!data || data.length === 0) {
                    historyList.innerHTML = '<p class="empty-text">No scans found yet. Start your first scan today!</p>';
                    updateTrendChart([]);
                    return;
                }

                renderHistoryItems(data);
                updateTrendChart(data);
            } catch (err) {
                console.error("Exception fetching history:", err);
                historyList.innerHTML = `<p class="error-text">An unexpected error occurred.</p>`;
            }
        }

        function renderHistoryItems(items) {
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '';

            if (!items || items.length === 0) {
                historyList.innerHTML = '<p class="empty-text">No scans found yet. Start your first scan today!</p>';
                return;
            }

            items.forEach(item => {
                const createdDate = new Date(item.created_at);

                const date = isNaN(createdDate)
                    ? 'Invalid Date'
                    : createdDate.toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                    });

                const div = document.createElement('div');
                div.className = 'history-item';
                div.setAttribute('data-id', item.id);
                div.innerHTML = `
                    <div class="history-info">
                        <h4>${item.patient_name || 'Anonymous'}</h4>
                        <div class="history-meta">${date}</div>
                    </div>
                    <div class="history-status" style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                        <div class="metric-value" style="font-size: 1.25rem; line-height: 1;">${item.heart_rate} <span style="font-size: 0.8rem;">BPM</span></div>
                        <span class="status-pill status-${(item.abnormality && (item.abnormality.toLowerCase() === 'normal' || item.abnormality.toLowerCase() === 'normal beat')) ? 'normal' : 'critical'}" style="max-width: 160px; text-align: right; word-wrap: break-word; line-height: 1.3;">
                            ${item.abnormality}
                        </span>
                    </div>
                    <button class="btn-delete-record" title="Delete this record" data-id="${item.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                    </button>
                `;

                // Wire up delete button
                div.querySelector('.btn-delete-record').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const recordId = e.currentTarget.getAttribute('data-id');
                    if (!confirm('Delete this scan record? This cannot be undone.')) return;

                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.style.opacity = '0.5';

                    const { error } = await _supabase
                        .from('reports')
                        .delete()
                        .eq('id', recordId);

                    if (error) {
                        alert('Error deleting record: ' + error.message);
                        btn.disabled = false;
                        btn.style.opacity = '1';
                    } else {
                        // Fade out and remove
                        div.style.transition = 'opacity 0.3s, transform 0.3s';
                        div.style.opacity = '0';
                        div.style.transform = 'translateX(20px)';
                        setTimeout(() => {
                            div.remove();
                            // If list is now empty, show empty state
                            if (historyList.children.length === 0) {
                                historyList.innerHTML = '<p class="empty-text">No scans found yet. Start your first scan today!</p>';
                            }
                        }, 300);
                    }
                });

                historyList.appendChild(div);
            });
        }

        function updateTrendChart(items) {
            const ctx = document.getElementById('trendChart');
            if (!ctx) return;

            const reversedItems = [...items].reverse();
            const labels = reversedItems.map(item => new Date(item.created_at).toLocaleDateString());
            const heartRates = reversedItems.map(item => item.heart_rate);

            if (window.trendChartInstance) window.trendChartInstance.destroy();

            window.trendChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Heart Rate (BPM)',
                        data: heartRates,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: false, suggestedMin: 40, suggestedMax: 120 } }
                }
            });

            const analysisEl = document.getElementById('trend-analysis');
            if (analysisEl && heartRates.length > 1) {
                const first = heartRates[0];
                const last = heartRates[heartRates.length - 1];
                const diff = last - first;
                const trend = diff > 0 ? 'increased' : 'decreased';
                analysisEl.textContent = `Your heart rate has ${trend} by ${Math.abs(diff)} BPM since your first scan.`;
            }
        }

        async function loadDistrictStats() {
            const ctx = document.getElementById('districtChart');
            const footerEl = document.getElementById('district-analysis');
            if (!ctx) return;

            try {
                // Fetch all reports to aggregate manually
                const { data, error } = await _supabase.from('reports').select('district, stress_level').not('district', 'is', null);

                if (error) throw error;
                if (!data || data.length === 0) {
                    if (footerEl) footerEl.textContent = 'Not enough regional data yet to show insights.';
                    return;
                }

                // Process data: aggregate into districts -> { Normal: count, High: count }
                const districtCounts = {};
                data.forEach(row => {
                    const dist = row.district;
                    if (!districtCounts[dist]) {
                        districtCounts[dist] = { Normal: 0, High: 0 };
                    }
                    if (row.stress_level === 'Low') districtCounts[dist].Normal += 1;
                    else districtCounts[dist].High += 1;
                });

                const labels = Object.keys(districtCounts).sort();
                const normalData = labels.map(d => districtCounts[d].Normal);
                const highData = labels.map(d => districtCounts[d].High);

                if (window.districtChartInstance) window.districtChartInstance.destroy();

                window.districtChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Normal Beats',
                                data: normalData,
                                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                                borderColor: '#22c55e',
                                borderWidth: 1
                            },
                            {
                                label: 'Abnormal (High Stress)',
                                data: highData,
                                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                                borderColor: '#ef4444',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: { stacked: false },
                            y: { stacked: false, beginAtZero: true, ticks: { stepSize: 1 } }
                        },
                        plugins: {
                            legend: { position: 'top' }
                        }
                    }
                });

                if (footerEl) footerEl.textContent = `Showing aggregated data across ${labels.length} districts in Kerala.`;

            } catch (err) {
                console.error('Error loading district stats:', err);
                if (footerEl) footerEl.textContent = 'Could not load regional comparisons.';
            }
        }

        // --- Aggressive Dashboard Load Logic ---
        if (isDashboardPage) {
            let historyLoaded = false;
            let attempts = 0;
            const historyList = document.getElementById('history-list');

            const historyInterval = setInterval(async () => {
                attempts++;
                try {
                    // Deep check via session
                    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

                    if (sessionError) {
                        if (historyList && attempts >= 5) {
                            historyList.innerHTML = `<p class="error-text">Session Error: ${sessionError.message}</p>`;
                            clearInterval(historyInterval);
                        }
                        return;
                    }

                    if (session && session.user && !historyLoaded) {
                        currentUser = session.user;
                        historyLoaded = true;
                        clearInterval(historyInterval);
                        await loadHistory();
                        await loadDistrictStats();
                        return;
                    }

                    // Timeout
                    if (attempts >= 10 && !historyLoaded) {
                        clearInterval(historyInterval);
                        if (historyList) {
                            historyList.innerHTML = `
                                <div style="text-align: left; color: #ef4444; padding: 2rem; background: #fee2e2; border-radius: 8px;">
                                    <p><strong>Failed to load session (Diagnostic Info).</strong></p>
                                    <p>Global currentUser: ${currentUser ? 'Yes' : 'No'}</p>
                                    <p>Session exists: ${session ? 'Yes' : 'No'}</p>
                                    <p>Session user exists: ${session?.user ? 'Yes' : 'No'}</p>
                                    <p>Please try logging out and logging back in.</p>
                                </div>
                            `;
                        }
                    }
                } catch (err) {
                    clearInterval(historyInterval);
                    if (historyList) historyList.innerHTML = `<p class="error-text">Crash in interval: ${err.message}</p>`;
                }
            }, 500);

            // Allow manual refresh
            const refreshBtn = document.getElementById('btn-refresh-history');
            if (refreshBtn) refreshBtn.addEventListener('click', loadHistory);
        }
    }
});
