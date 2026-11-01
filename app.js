/**
 * 極光選號 - 現代美型隨機數字抽籤器
 * 核心互動邏輯與音效、粒子慶祝引擎
 */

(() => {
  'use strict';

  // ==========================================================================
  // DOM 元素快取
  // ==========================================================================
  const minInput = document.getElementById('min-val-input');
  const maxInput = document.getElementById('max-val-input');
  const countInput = document.getElementById('draw-count-input');
  const uniqueToggle = document.getElementById('unique-toggle');
  const speedSelect = document.getElementById('speed-select');
  const drawButton = document.getElementById('draw-button');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');

  const resultCard = document.getElementById('result-card');
  const primaryNumberEl = document.getElementById('primary-number');
  const singleDisplayEl = document.getElementById('single-number-display');
  const multiNumbersGrid = document.getElementById('multi-numbers-grid');
  const statusBadge = document.getElementById('card-status-badge');
  const statusText = document.getElementById('status-text');
  const currentRangeIndicator = document.getElementById('current-range-indicator');
  const quickCopyBtn = document.getElementById('quick-copy-btn');
  const rangeErrorTip = document.getElementById('range-error-tip');

  // 步進按鈕
  const minDecBtn = document.getElementById('min-step-dec');
  const minIncBtn = document.getElementById('min-step-inc');
  const maxDecBtn = document.getElementById('max-step-dec');
  const maxIncBtn = document.getElementById('max-step-inc');
  const countDecBtn = document.getElementById('count-step-dec');
  const countIncBtn = document.getElementById('count-step-inc');

  // 常用預設
  const presetChips = document.querySelectorAll('.preset-chip');

  // 統計與歷史
  const statTotalRolls = document.getElementById('stat-total-rolls');
  const statLastNumber = document.getElementById('stat-last-number');
  const statHistoryAvg = document.getElementById('stat-history-avg');
  const statFrequentNum = document.getElementById('stat-frequent-num');

  const historyEmpty = document.getElementById('history-empty');
  const historyTagsGrid = document.getElementById('history-tags-grid');
  const historyCountBadge = document.getElementById('history-count');
  const copyHistoryBtn = document.getElementById('copy-history-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // Toast
  const toastEl = document.getElementById('toast-message');
  const toastText = document.getElementById('toast-text');

  // Canvas
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');

  // ==========================================================================
  // 狀態管理
  // ==========================================================================
  let isRolling = false;
  let isSoundEnabled = localStorage.getItem('aurora_sound_enabled') !== 'false';
  let historyList = [];
  let toastTimer = null;
  let audioCtx = null;
  let currentResults = [];

  // ==========================================================================
  // Web Audio API 擬真動態音效合成 (零外部依賴、超低延遲)
  // ==========================================================================
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // 滾動時計數跳動聲 (機械清脆感)
  function playTickSound() {
    if (!isSoundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'triangle';
      // 隨機微調頻率增加機械動態感
      osc.frequency.setValueAtTime(450 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // 靜默捕捉音訊異常
    }
  }

  // 開獎揭曉和弦風鈴聲
  function playWinSound() {
    if (!isSoundEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      // 和弦音階 (C大調三和弦 + 高音叮聲)
      const freqs = [523.25, 659.25, 783.99, 1046.5];

      freqs.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const noteStart = now + index * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.45);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.45);
      });
    } catch {
      // 靜默捕捉音訊異常
    }
  }

  // 錯誤提示音
  function playErrorSound() {
    if (!isSoundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.08);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  function updateSoundUI() {
    if (isSoundEnabled) {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      soundToggleBtn.setAttribute('title', '關閉音效 (M)');
    } else {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
      soundToggleBtn.setAttribute('title', '開啟音效 (M)');
    }
    localStorage.setItem('aurora_sound_enabled', isSoundEnabled);
  }

  // ==========================================================================
  // 慶祝彩帶粒子物理引擎 (Canvas Confetti System)
  // ==========================================================================
  let confettiParticles = [];
  let confettiAnimationId = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const CONFETTI_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#38bdf8'
  ];

  class ConfettiPiece {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const velocity = 5 + Math.random() * 9;
      this.vx = Math.cos(angle) * velocity;
      this.vy = Math.sin(angle) * velocity - 3;
      this.gravity = 0.25;
      this.friction = 0.96;
      this.size = 6 + Math.random() * 6;
      this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      this.rotation = Math.random() * 360;
      this.rotationSpeed = (Math.random() - 0.5) * 12;
      this.opacity = 1;
      this.decay = 0.012 + Math.random() * 0.015;
    }

    update() {
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.rotationSpeed;
      this.opacity -= this.decay;
    }

    draw(c) {
      if (this.opacity <= 0) return;
      c.save();
      c.translate(this.x, this.y);
      c.rotate((this.rotation * Math.PI) / 180);
      c.globalAlpha = Math.max(0, this.opacity);
      c.fillStyle = this.color;
      c.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 1.5);
      c.restore();
    }
  }

  function fireCelebration(x, y) {
    const originX = x || window.innerWidth / 2;
    const originY = y || window.innerHeight * 0.35;

    for (let i = 0; i < 75; i++) {
      confettiParticles.push(new ConfettiPiece(originX, originY));
    }

    if (!confettiAnimationId) {
      animateConfetti();
    }
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.update();
      p.draw(ctx);
      if (p.opacity <= 0 || p.y > canvas.height) {
        confettiParticles.splice(i, 1);
      }
    }

    if (confettiParticles.length > 0) {
      confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
      cancelAnimationFrame(confettiAnimationId);
      confettiAnimationId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ==========================================================================
  // 核心選號與隨機數邏輯
  // ==========================================================================
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 生成不重複隨機數組
  function getRandomNumbers(min, max, count, unique) {
    const rangeSize = max - min + 1;
    if (unique && count > rangeSize) {
      count = rangeSize; // 自動截斷以防止死循環
    }

    if (unique) {
      // 斐雪-耶茨洗牌法變體取樣
      if (rangeSize <= 10000) {
        const pool = [];
        for (let i = min; i <= max; i++) pool.push(i);
        const results = [];
        for (let i = 0; i < count; i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          results.push(pool.splice(randomIndex, 1)[0]);
        }
        return results;
      } else {
        // 大範圍使用 Set 取樣
        const set = new Set();
        while (set.size < count) {
          set.add(getRandomInt(min, max));
        }
        return Array.from(set);
      }
    } else {
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push(getRandomInt(min, max));
      }
      return results;
    }
  }

  // 驗證範圍合法性
  function validateInputs() {
    const min = parseInt(minInput.value, 10);
    const max = parseInt(maxInput.value, 10);
    let count = parseInt(countInput.value, 10);

    if (isNaN(min) || isNaN(max)) {
      showError('請輸入有效的數字範圍');
      return false;
    }

    if (min >= max) {
      showError('最小值必須小於最大值！');
      return false;
    }

    if (isNaN(count) || count < 1) {
      countInput.value = 1;
      count = 1;
    }
    if (count > 50) {
      countInput.value = 50;
      count = 50;
    }

    const isUnique = uniqueToggle.checked;
    const rangeSpan = max - min + 1;
    if (isUnique && count > rangeSpan) {
      showError(`在此範圍內最多只能抽出 ${rangeSpan} 個不重複號碼`);
      countInput.value = rangeSpan;
    } else {
      hideError();
    }

    currentRangeIndicator.textContent = `範圍: ${min} ~ ${max}`;
    return true;
  }

  function showError(msg) {
    rangeErrorTip.textContent = `⚠️ ${msg}`;
    rangeErrorTip.classList.remove('hidden');
    drawButton.disabled = true;
  }

  function hideError() {
    rangeErrorTip.classList.add('hidden');
    drawButton.disabled = false;
  }

  // ==========================================================================
  // 滾動動畫與開獎流程 (Deceleration Curve Slot Machine)
  // ==========================================================================
  function startDraw() {
    initAudioContext();
    if (isRolling) return;
    if (!validateInputs()) {
      playErrorSound();
      return;
    }

    const min = parseInt(minInput.value, 10);
    const max = parseInt(maxInput.value, 10);
    const count = parseInt(countInput.value, 10);
    const isUnique = uniqueToggle.checked;
    const speedMode = speedSelect.value;

    isRolling = true;
    drawButton.disabled = true;
    resultCard.classList.add('is-rolling');
    statusText.textContent = '命運輪盤旋轉中...';

    // 預先計算最終結果
    const finalNumbers = getRandomNumbers(min, max, count, isUnique);
    currentResults = finalNumbers;

    // 動畫參數
    let duration = 900;
    let initialInterval = 35;
    if (speedMode === 'fast') {
      duration = 400;
      initialInterval = 25;
    } else if (speedMode === 'instant') {
      finishDraw(finalNumbers, count);
      return;
    }

    // 介面切換：單數或多數
    if (count === 1) {
      singleDisplayEl.classList.remove('hidden');
      multiNumbersGrid.classList.add('hidden');
      runSingleRollAnimation(min, max, finalNumbers[0], duration, initialInterval);
    } else {
      singleDisplayEl.classList.add('hidden');
      multiNumbersGrid.classList.remove('hidden');
      runMultiRollAnimation(min, max, finalNumbers, count, duration, initialInterval);
    }
  }

  // 單號碼滾動動畫
  function runSingleRollAnimation(min, max, finalNum, duration, initialInterval) {
    const startTime = performance.now();
    let lastTick = 0;
    let currentInterval = initialInterval;

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (currentTime - lastTick >= currentInterval) {
        lastTick = currentTime;
        primaryNumberEl.textContent = getRandomInt(min, max);
        primaryNumberEl.classList.remove('pop');
        playTickSound();

        // 減速二次方緩動：隨時間推移增加 interval
        currentInterval = initialInterval + Math.pow(progress, 2.5) * 160;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        primaryNumberEl.textContent = finalNum;
        finishDraw([finalNum], 1);
      }
    }

    requestAnimationFrame(step);
  }

  // 多號碼滾動動畫
  function runMultiRollAnimation(min, max, finalNums, count, duration, initialInterval) {
    multiNumbersGrid.innerHTML = '';
    const chipEls = [];
    for (let i = 0; i < count; i++) {
      const chip = document.createElement('div');
      chip.className = 'multi-num-chip';
      chip.textContent = getRandomInt(min, max);
      multiNumbersGrid.appendChild(chip);
      chipEls.push(chip);
    }

    const startTime = performance.now();
    let lastTick = 0;
    let currentInterval = initialInterval;

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (currentTime - lastTick >= currentInterval) {
        lastTick = currentTime;
        chipEls.forEach((chip) => {
          chip.textContent = getRandomInt(min, max);
        });
        playTickSound();
        currentInterval = initialInterval + Math.pow(progress, 2.2) * 150;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        chipEls.forEach((chip, idx) => {
          chip.textContent = finalNums[idx];
          chip.style.animationDelay = `${idx * 0.05}s`;
        });
        finishDraw(finalNums, count);
      }
    }

    requestAnimationFrame(step);
  }

  // 完成抽籤後的慶祝與紀錄
  function finishDraw(numbers, count) {
    isRolling = false;
    drawButton.disabled = false;
    resultCard.classList.remove('is-rolling');
    statusText.textContent = count === 1 ? '✨ 幸運號碼揭曉！' : `✨ 成功抽出 ${count} 個號碼！`;

    // 慶祝與動畫效果
    resultCard.classList.remove('celebrate');
    void resultCard.offsetWidth; // 重置觸發動畫
    resultCard.classList.add('celebrate');

    if (count === 1) {
      primaryNumberEl.classList.remove('pop');
      void primaryNumberEl.offsetWidth;
      primaryNumberEl.classList.add('pop');
    }

    playWinSound();

    // 觸發粒子發射
    const rect = resultCard.getBoundingClientRect();
    fireCelebration(rect.left + rect.width / 2, rect.top + rect.height / 2);

    // 新增歷史與更新統計
    recordHistory(numbers);
  }

  // ==========================================================================
  // 歷史紀錄與統計計算
  // ==========================================================================
  function recordHistory(numbers) {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    numbers.forEach((num) => {
      historyList.unshift({
        num: num,
        time: timeStr
      });
    });

    // 保持最多 100 筆紀錄
    if (historyList.length > 100) {
      historyList = historyList.slice(0, 100);
    }

    renderHistory();
    updateStats();
    saveHistoryToLocal();
  }

  function renderHistory() {
    if (historyList.length === 0) {
      historyEmpty.classList.remove('hidden');
      historyTagsGrid.classList.add('hidden');
      historyTagsGrid.innerHTML = '';
      historyCountBadge.textContent = '0';
      return;
    }

    historyEmpty.classList.add('hidden');
    historyTagsGrid.classList.remove('hidden');
    historyTagsGrid.innerHTML = '';
    historyCountBadge.textContent = historyList.length;

    historyList.forEach((item) => {
      const tag = document.createElement('div');
      tag.className = 'history-item';
      tag.title = '點擊複製此號碼';
      tag.innerHTML = `
        <span class="history-num">${item.num}</span>
        <span class="history-time">${item.time}</span>
      `;
      tag.addEventListener('click', () => {
        copyText(String(item.num), `已複製號碼 ${item.num}`);
      });
      historyTagsGrid.appendChild(tag);
    });
  }

  function updateStats() {
    if (historyList.length === 0) {
      statTotalRolls.innerHTML = `0 <small>次</small>`;
      statLastNumber.textContent = '-';
      statHistoryAvg.textContent = '-';
      statFrequentNum.textContent = '-';
      return;
    }

    statTotalRolls.innerHTML = `${historyList.length} <small>次</small>`;
    statLastNumber.textContent = historyList[0].num;

    // 計算平均值
    const sum = historyList.reduce((acc, cur) => acc + cur.num, 0);
    const avg = (sum / historyList.length).toFixed(1);
    statHistoryAvg.textContent = avg;

    // 計算眾數 (出現頻率最高)
    const freqMap = {};
    let maxFreq = 0;
    let mostFrequent = historyList[0].num;
    historyList.forEach((item) => {
      freqMap[item.num] = (freqMap[item.num] || 0) + 1;
      if (freqMap[item.num] > maxFreq) {
        maxFreq = freqMap[item.num];
        mostFrequent = item.num;
      }
    });
    statFrequentNum.textContent = `${mostFrequent} (${maxFreq}次)`;
  }

  function saveHistoryToLocal() {
    try {
      localStorage.setItem('aurora_history_records', JSON.stringify(historyList));
    } catch {}
  }

  function loadHistoryFromLocal() {
    try {
      const saved = localStorage.getItem('aurora_history_records');
      if (saved) {
        historyList = JSON.parse(saved);
        renderHistory();
        updateStats();
      }
    } catch {}
  }

  // ==========================================================================
  // 複製輔助與 Toast 提示
  // ==========================================================================
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastText.textContent = message;
    toastEl.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2200);
  }

  function copyText(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || '已複製到剪貼簿！');
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || '已複製到剪貼簿！');
    } catch {
      showToast('複製失敗，請手動選取');
    }
    document.body.removeChild(textarea);
  }

  // ==========================================================================
  // 事件監聽與綁定
  // ==========================================================================
  function setupEventListeners() {
    // 抽籤按鈕點擊
    drawButton.addEventListener('click', startDraw);

    // 鍵盤快速鍵: 空白鍵或 Enter
    window.addEventListener('keydown', (e) => {
      // 若當前在輸入框中打字，不觸發全局抽籤
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.activeElement.blur();
          startDraw();
        }
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        startDraw();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        isSoundEnabled = !isSoundEnabled;
        updateSoundUI();
        showToast(isSoundEnabled ? '🔊 已開啟音效' : '🔇 已靜音');
      }
    });

    // 音效切換
    soundToggleBtn.addEventListener('click', () => {
      initAudioContext();
      isSoundEnabled = !isSoundEnabled;
      updateSoundUI();
      showToast(isSoundEnabled ? '🔊 已開啟音效' : '🔇 已靜音');
    });

    // 步進按鈕處理
    minDecBtn.addEventListener('click', () => {
      minInput.value = parseInt(minInput.value, 10) - 1;
      validateInputs();
    });
    minIncBtn.addEventListener('click', () => {
      minInput.value = parseInt(minInput.value, 10) + 1;
      validateInputs();
    });
    maxDecBtn.addEventListener('click', () => {
      maxInput.value = parseInt(maxInput.value, 10) - 1;
      validateInputs();
    });
    maxIncBtn.addEventListener('click', () => {
      maxInput.value = parseInt(maxInput.value, 10) + 1;
      validateInputs();
    });

    countDecBtn.addEventListener('click', () => {
      const cur = parseInt(countInput.value, 10);
      if (cur > 1) {
        countInput.value = cur - 1;
        validateInputs();
      }
    });
    countIncBtn.addEventListener('click', () => {
      const cur = parseInt(countInput.value, 10);
      if (cur < 50) {
        countInput.value = cur + 1;
        validateInputs();
      }
    });

    // 輸入值即時驗證
    [minInput, maxInput, countInput].forEach((input) => {
      input.addEventListener('input', validateInputs);
    });
    uniqueToggle.addEventListener('change', validateInputs);

    // 常用預設點選
    presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        presetChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        const min = chip.dataset.min;
        const max = chip.dataset.max;
        const count = chip.dataset.count;
        const unique = chip.dataset.unique;

        if (min !== undefined) minInput.value = min;
        if (max !== undefined) maxInput.value = max;
        if (count !== undefined) countInput.value = count;
        else countInput.value = 1;

        if (unique !== undefined) uniqueToggle.checked = (unique === 'true');
        else uniqueToggle.checked = false;

        validateInputs();
      });
    });

    // 複製當前結果
    quickCopyBtn.addEventListener('click', () => {
      if (currentResults.length === 0) {
        showToast('尚無抽籤結果可複製！');
        return;
      }
      const text = currentResults.join(', ');
      copyText(text, `已複製結果：${text}`);
    });

    // 複製歷史全部
    copyHistoryBtn.addEventListener('click', () => {
      if (historyList.length === 0) {
        showToast('歷史紀錄為空！');
        return;
      }
      const text = historyList.map((h) => `${h.num} (${h.time})`).join('\n');
      copyText(text, '已複製完整歷史紀錄！');
    });

    // 清空歷史
    clearHistoryBtn.addEventListener('click', () => {
      if (historyList.length === 0) return;
      if (confirm('確定要清空所有抽籤紀錄嗎？')) {
        historyList = [];
        renderHistory();
        updateStats();
        localStorage.removeItem('aurora_history_records');
        showToast('已清空歷史紀錄');
      }
    });
  }

  // ==========================================================================
  // 初始化啟動
  // ==========================================================================
  function init() {
    updateSoundUI();
    validateInputs();
    loadHistoryFromLocal();
    setupEventListeners();
  }

  init();
})();
