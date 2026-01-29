pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let files = [];
let unlockedPdfs = new Map();

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const filesContainer = document.getElementById('filesContainer');
const filesList = document.getElementById('filesList');
const fileCount = document.getElementById('fileCount');
const addMoreBtn = document.getElementById('addMoreBtn');
const unlockAllBtn = document.getElementById('unlockAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const useUnifiedPassword = document.getElementById('useUnifiedPassword');
const unifiedPasswordInput = document.getElementById('unifiedPasswordInput');
const unifiedPasswordSection = document.getElementById('unifiedPasswordSection');
const mergeSwitch = document.getElementById('mergeSwitch');
const downloadModeSection = document.getElementById('downloadModeSection');
const progressOverlay = document.getElementById('progressOverlay');
const progressText = document.getElementById('progressText');
const progressDetail = document.getElementById('progressDetail');

uploadZone.addEventListener('click', () => fileInput.click());
addMoreBtn.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addFiles(Array.from(e.target.files));
    }
    fileInput.value = '';
});

unlockAllBtn.addEventListener('click', unlockAllFiles);
downloadAllBtn.addEventListener('click', downloadFiles);

useUnifiedPassword.addEventListener('change', function () {
    unifiedPasswordInput.disabled = !this.checked;
    if (this.checked) {
        unifiedPasswordInput.focus();
    }
    updateUI();
});



function addFiles(newFiles) {
    newFiles.forEach(file => {
        const fileId = Date.now() + Math.random();
        files.push({
            id: fileId,
            file: file,
            status: 'pending',
            needsPassword: false,
            password: '',
            error: null
        });
    });

    updateUI();
    checkAllFiles();
}

function updateUI() {
    if (files.length === 0) {
        uploadZone.style.display = 'block';
        filesContainer.style.display = 'none';
        return;
    }

    uploadZone.style.display = 'none';
    filesContainer.style.display = 'block';
    fileCount.textContent = files.length;

    const hasLockedFiles = files.some(f => f.status === 'locked');
    const hasMultipleLockedFiles = files.filter(f => f.status === 'locked').length > 1;
    unifiedPasswordSection.style.display = (hasLockedFiles && hasMultipleLockedFiles) ? 'block' : 'none';

    const hasUnlockedFiles = files.some(f => f.status === 'unlocked');
    downloadModeSection.style.display = (hasUnlockedFiles && files.length > 1) ? 'flex' : 'none';

    filesList.innerHTML = '';
    files.forEach(fileData => {
        const fileItem = createFileItem(fileData);
        filesList.appendChild(fileItem);
    });

    updateDownloadButton();
}

function createFileItem(fileData) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.id = fileData.id;

    if (fileData.status === 'unlocked') {
        div.classList.add('unlocked');
    } else if (fileData.status === 'error') {
        div.classList.add('error');
    }

    const statusIcon = fileData.status === 'unlocked'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>';

    const statusText = {
        'pending': '等待檢查',
        'checking': '檢查中...',
        'locked': '需要密碼',
        'unlocked': '已解鎖',
        'error': '錯誤'
    }[fileData.status] || '未知';

    const statusClass = fileData.status === 'unlocked' ? 'unlocked' :
        fileData.status === 'locked' ? 'locked' :
            fileData.status === 'error' ? 'error' : '';

    const showPasswordInput = fileData.needsPassword && fileData.status !== 'unlocked' && !useUnifiedPassword.checked;

    div.innerHTML = `
        <div class="file-header">
            <svg class="file-icon ${fileData.status === 'unlocked' ? 'unlocked' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                ${statusIcon}
            </svg>
            <div class="file-info">
                <div class="file-name">${fileData.file.name}</div>
                <div class="file-meta">
                    <span>${formatFileSize(fileData.file.size)}</span>
                    <span class="file-status ${statusClass}">
                        <span class="status-dot"></span>
                        ${statusText}
                    </span>
                </div>
            </div>
            <button class="remove-file-btn" onclick="removeFile(${fileData.id})">×</button>
        </div>
        ${showPasswordInput ? `
            <div class="file-password">
                <input type="password" 
                       class="password-input" 
                       placeholder="輸入 PDF 密碼" 
                       data-id="${fileData.id}"
                       value="${fileData.password}">
                <button class="unlock-single-btn" onclick="unlockSingleFile(${fileData.id})">解鎖</button>
            </div>
        ` : ''}
        ${fileData.error ? `<div style="color: var(--danger); font-size: 13px; margin-top: 8px;">${fileData.error}</div>` : ''}
    `;

    return div;
}

async function checkAllFiles() {
    for (const fileData of files) {
        if (fileData.status === 'pending') {
            await checkFile(fileData);
        }
    }
    updateUI();
}

async function checkFile(fileData) {
    fileData.status = 'checking';
    updateUI();

    try {
        const arrayBuffer = await fileData.file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        await pdfjsLib.getDocument({ data: data }).promise;

        fileData.status = 'unlocked';
        fileData.needsPassword = false;
        unlockedPdfs.set(fileData.id, data);
    } catch (error) {
        if (error.name === 'PasswordException') {
            fileData.status = 'locked';
            fileData.needsPassword = true;
        } else {
            fileData.status = 'error';
            fileData.error = '文件讀取失敗';
        }
    }

    updateUI();
}

async function unlockSingleFile(fileId) {
    const fileData = files.find(f => f.id === fileId);
    if (!fileData) return;

    const passwordInput = document.querySelector(`input[data-id="${fileId}"]`);
    const password = passwordInput.value.trim();

    if (!password) {
        alert('請輸入密碼');
        return;
    }

    fileData.password = password;

    showProgress('解鎖中...', fileData.file.name);

    try {
        const unlockedPdf = await unlockPDF(fileData.file, password);
        unlockedPdfs.set(fileId, unlockedPdf);
        fileData.status = 'unlocked';
        fileData.error = null;
    } catch (error) {
        if (error.name === 'PasswordException' || error.message.includes('password')) {
            fileData.error = '密碼錯誤';
            passwordInput.select();
        } else {
            fileData.error = '處理失敗：' + error.message;
        }
    }

    hideProgress();
    updateUI();
}

async function unlockAllFiles() {
    const lockedFiles = files.filter(f => f.status === 'locked');

    if (lockedFiles.length === 0) {
        alert('沒有需要解鎖的文件');
        return;
    }

    const useUnified = useUnifiedPassword.checked;
    const unifiedPwd = unifiedPasswordInput.value.trim();

    if (useUnified) {
        if (!unifiedPwd) {
            alert('請輸入統一密碼');
            return;
        }
        lockedFiles.forEach(f => f.password = unifiedPwd);
    } else {
        lockedFiles.forEach(fileData => {
            const passwordInput = document.querySelector(`input[data-id="${fileData.id}"]`);
            if (passwordInput) {
                fileData.password = passwordInput.value.trim();
            }
        });

        const missingPassword = lockedFiles.find(f => !f.password);
        if (missingPassword) {
            alert('請為所有文件輸入密碼');
            return;
        }
    }

    unlockAllBtn.disabled = true;

    for (let i = 0; i < lockedFiles.length; i++) {
        const fileData = lockedFiles[i];
        showProgress(`解鎖文件 ${i + 1}/${lockedFiles.length}`, fileData.file.name);

        try {
            const unlockedPdf = await unlockPDF(fileData.file, fileData.password);
            unlockedPdfs.set(fileData.id, unlockedPdf);
            fileData.status = 'unlocked';
            fileData.error = null;
        } catch (error) {
            if (error.name === 'PasswordException' || error.message.includes('password')) {
                fileData.error = '密碼錯誤';
                // 顯示彈窗提示
                setTimeout(() => {
                    alert(`文件 "${fileData.file.name}" 密碼錯誤，請重新輸入`);
                }, 100);
            } else {
                fileData.error = '處理失敗：' + error.message;
            }
        }

        updateUI();
    }

    hideProgress();
    unlockAllBtn.disabled = false;
    updateUI();
}

async function unlockPDF(file, password) {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjsLib.getDocument({
        data: data,
        password: password
    });

    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    const newPdf = await PDFLib.PDFDocument.create();

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());

        const image = await newPdf.embedJpg(imgBytes);
        const pdfPage = newPdf.addPage([viewport.width, viewport.height]);
        pdfPage.drawImage(image, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height
        });
    }

    const unlockedPdfBytes = await newPdf.save();
    return unlockedPdfBytes;
}

async function downloadFiles() {
    const unlockedFiles = files.filter(f => f.status === 'unlocked');

    if (unlockedFiles.length === 0) {
        alert('沒有可下載的文件');
        return;
    }

    if (mergeSwitch.checked && unlockedFiles.length > 1) {
        await downloadMergedPDF(unlockedFiles);
    } else {
        await downloadSeparateFiles(unlockedFiles);
    }
}

async function downloadMergedPDF(unlockedFiles) {
    showProgress('合併 PDF...', `共 ${unlockedFiles.length} 個文件`);

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (let i = 0; i < unlockedFiles.length; i++) {
            const fileData = unlockedFiles[i];
            updateProgress(`合併文件 ${i + 1}/${unlockedFiles.length}`, fileData.file.name);

            const pdfBytes = unlockedPdfs.get(fileData.id);
            const pdf = await PDFLib.PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
        }

        updateProgress('生成合併文件...', '');

        const mergedPdfBytes = await mergedPdf.save();
        downloadPDFBytes(mergedPdfBytes, 'merged_unlocked.pdf');

        hideProgress();
    } catch (error) {
        hideProgress();
        alert('合併失敗：' + error.message);
    }
}

async function downloadSeparateFiles(unlockedFiles) {
    showProgress('準備下載...', `共 ${unlockedFiles.length} 個文件`);

    for (let i = 0; i < unlockedFiles.length; i++) {
        const fileData = unlockedFiles[i];
        updateProgress(`下載文件 ${i + 1}/${unlockedFiles.length}`, fileData.file.name);

        const pdfBytes = unlockedPdfs.get(fileData.id);
        const originalName = fileData.file.name;
        const newName = originalName.replace('.pdf', '_unlocked.pdf');

        downloadPDFBytes(pdfBytes, newName);

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    hideProgress();
}

function downloadPDFBytes(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // 創建連結
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    // 強制所有瀏覽器在新分頁開啟（嘗試解決 LINE 等通訊軟體內建瀏覽器的問題）
    a.target = '_blank';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 延長 URL 有效期至 60 秒，確保新頁面有足夠時間載入
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function removeFile(fileId) {
    files = files.filter(f => f.id !== fileId);
    unlockedPdfs.delete(fileId);
    updateUI();
}

function updateDownloadButton() {
    const hasUnlocked = files.some(f => f.status === 'unlocked');
    downloadAllBtn.disabled = !hasUnlocked;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showProgress(text, detail = '') {
    progressText.textContent = text;
    progressDetail.textContent = detail;
    progressOverlay.style.display = 'flex';
}

function updateProgress(text, detail = '') {
    progressText.textContent = text;
    progressDetail.textContent = detail;
}

function hideProgress() {
    progressOverlay.style.display = 'none';
}
