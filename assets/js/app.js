/**
 * ==========================================================================
 * ACTUALIZADOR MASIVO PARA SWITCHES S600 C-137 v1.9 - OFICIAL
 * Motor de Interactividad Vanilla JavaScript (Zero-Dependencies, Zero-CORS)
 * 100% Standalone Corporativo SOMOS C-137 (file:/// y Web)
 * ==========================================================================
 */

(function () {
  'use strict';

  // --- 1. Estado Global de la Aplicación ---
  const state = {
    isMuted: false,
    audioCtx: null,
    simPaso1: {
      running: false,
      timer: null,
      currentIndex: 0,
      totalSwitches: 4,
      baseIP: '192.168.0.2',
    },
    simPaso2: {
      running: false,
      timer: null,
      switches: [],
      globalProgress: 0,
      batchSize: 4,
      restoreFactory: false,
    },
    activeArchLayer: 0,
  };

  // --- 2. Inicializador de Audio (Web Audio API Synthesizer) ---
  function getAudioContext() {
    if (!state.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        state.audioCtx = new AudioCtxClass();
      }
    }
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  function playTone(freq, durationMs, type = 'sine', startTimeOffset = 0) {
    if (state.isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + startTimeOffset);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + startTimeOffset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTimeOffset + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTimeOffset);
      osc.stop(ctx.currentTime + startTimeOffset + durationMs / 1000 + 0.02);
    } catch (e) {
      console.warn('Audio synthesis warning:', e);
    }
  }

  // Tonos Oficiales de app_gui.py
  function playSoundPrompt() {
    // D5 (587 Hz, 90ms) ➔ A5 (880 Hz, 170ms)
    playTone(587.33, 90, 'sine', 0);
    playTone(880.00, 170, 'sine', 0.11);
  }

  function playSoundSuccess() {
    // C5 (523 Hz, 90ms) ➔ E5 (659 Hz, 90ms) ➔ G5 (784 Hz, 160ms)
    playTone(523.25, 90, 'triangle', 0);
    playTone(659.25, 90, 'triangle', 0.10);
    playTone(783.99, 160, 'triangle', 0.20);
  }

  function playSoundWarning() {
    // A4 (440 Hz, 110ms) x2
    playTone(440.00, 110, 'square', 0);
    playTone(440.00, 110, 'square', 0.18);
  }

  function playSoundError() {
    // E4 (330 Hz, 150ms) ➔ C4 (260 Hz, 240ms)
    playTone(329.63, 150, 'sawtooth', 0);
    playTone(261.63, 240, 'sawtooth', 0.18);
  }

  // --- 3. Capas de Arquitectura (R1) ---
  const archLayersData = [
    {
      badge: 'CAPA 1: PRESENTACIÓN',
      title: 'UltraDarkAppGUI (Tkinter / TTK)',
      desc: 'Interfaz de usuario industrial de alto contraste en Dark Zinc (#09090b). Integración nativa Win32 (SetProcessDpiAwarenessContext Per-Monitor v2), dispatch seguro entre hilos vía safe_gui_call(root.after(0)), tabla de switches interactiva con tags dinámicos y consola de auditoría.',
      code: `# app_gui.py - Dispatch seguro en UI
def safe_gui_call(func, *args):
    """Encola llamadas de hilos secundarios en el loop de Tkinter"""
    if root and root.winfo_exists():
        root.after(0, lambda: func(*args))`
    },
    {
      badge: 'CAPA 2: CONTROL & EXCLUSIÓN MUTUA',
      title: 'Mutex de Red & Single Instance',
      desc: 'Protección estricta contra colisiones de red. El mutex de hardware _BASE_IP_LOCK (threading.RLock()) garantiza que sólo un switch esté siendo reconfigurado a la vez en 192.168.0.1. A nivel de SO, SingleInstanceManager evita múltiples procesos concurrentes mediante CreateMutexW.',
      code: `# switch_manager.py - Exclusión mutua de hardware
_BASE_IP_LOCK = threading.RLock()

def change_ip_sequential(origin_ip, target_ip, ...):
    with _BASE_IP_LOCK:
        clear_arp_cache(origin_ip)
        # SSH a 192.168.0.1 y reconfiguración atómica`
    },
    {
      badge: 'CAPA 3: CLIENTE DE RED & SSH',
      title: 'SwitchManager (Paramiko Engine)',
      desc: 'Conexión automatizada SSHv2 sobre puerto 22 con AutoAddPolicy. Emulación de shell interactivo VT100 (invoke_shell), timeouts dinámicos, polling ICMP no invasivo para vigilar reinicios de hardware y parseo de expresiones regulares para validar versiones de kernel y firmware.',
      code: `# switch_manager.py - Shell interactivo y verificación
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(ip, username="admin", password="admin", timeout=10)
shell = client.invoke_shell()
shell.send("enable\\nshow version\\n")`
    },
    {
      badge: 'CAPA 4: SERVIDOR TFTP EN RAM',
      title: 'RFC 1350 Zero Disk I/O Listener',
      desc: 'Servidor TFTP RFC 1350 puro en sockets UDP nativos (0.0.0.0:69). Carga el firmware (~23.7 MB) completamente en memoria RAM (self.file_data). Cada petición RRQ genera un worker independiente con socket efímero; no existe contención de disco ni bloqueos de archivo durante flasheos masivos.',
      code: `# tftp_server.py - Servidor multihilo en RAM
def load_firmware(self, path):
    with open(path, 'rb') as f:
        self.file_data = f.read()  # En RAM permanente

# Worker dedicado con socket efímero por switch
worker_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)`
    }
  ];

  function initArchVisualizer() {
    const listContainer = document.getElementById('arch-layers-list');
    const badgeEl = document.getElementById('arch-detail-badge');
    const titleEl = document.getElementById('arch-detail-title');
    const descEl = document.getElementById('arch-detail-desc');
    const codeEl = document.getElementById('arch-detail-code');

    if (!listContainer || !badgeEl || !titleEl || !descEl || !codeEl) return;

    listContainer.innerHTML = '';
    archLayersData.forEach((layer, idx) => {
      const card = document.createElement('div');
      card.className = `arch-layer-card ${idx === 0 ? 'active' : ''}`;
      card.dataset.index = idx;
      card.innerHTML = `
        <div class="arch-layer-header">
          <span class="arch-layer-badge">${layer.badge}</span>
        </div>
        <div class="arch-layer-title">${layer.title}</div>
        <div class="arch-layer-desc">${layer.desc.substring(0, 95)}...</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.arch-layer-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.activeArchLayer = idx;

        badgeEl.textContent = layer.badge;
        titleEl.textContent = layer.title;
        descEl.textContent = layer.desc;
        codeEl.textContent = layer.code;
      });

      listContainer.appendChild(card);
    });

    // Carga inicial
    badgeEl.textContent = archLayersData[0].badge;
    titleEl.textContent = archLayersData[0].title;
    descEl.textContent = archLayersData[0].desc;
    codeEl.textContent = archLayersData[0].code;
  }

  // --- 4. Calculadora de Subred & Pool de IPs (Paso 1) ---
  function initSubnetCalculator() {
    const startIpInput = document.getElementById('calc-start-ip');
    const countInput = document.getElementById('calc-count');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const resultsTbody = document.getElementById('calc-results-tbody');
    const cliOutput = document.getElementById('calc-cli-script');
    const summarySpan = document.getElementById('calc-summary-range');

    if (!startIpInput || !countInput || !resultsTbody || !cliOutput) return;

    function parseIP(ipStr) {
      if (!ipStr || typeof ipStr !== 'string') return null;
      const trimmed = ipStr.trim();
      const match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (!match) return null;
      const nums = [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10)];
      if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
      return nums;
    }

    function formatIP(nums) {
      return nums.join('.');
    }

    function calculate() {
      const baseNums = parseIP(startIpInput.value);
      let count = parseInt(countInput.value, 10);

      if (!baseNums) {
        if (summarySpan) {
          summarySpan.textContent = 'IP de inicio inválida';
          summarySpan.className = 'tag-badge amber';
        }
        resultsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--red-text); padding: 1.5rem;">Por favor ingrese una dirección IPv4 válida (ej. 192.168.0.2). Formato: X.X.X.X sin caracteres adicionales.</td></tr>';
        cliOutput.textContent = '# Formato de IP inválido. Ingrese una dirección IPv4 válida.';
        return;
      }

      // Validación de IP de red (.0) y broadcast (.255)
      if (baseNums[3] === 0 || baseNums[3] === 255) {
        const typeStr = baseNums[3] === 0 ? 'dirección de red (.0)' : 'dirección de broadcast (.255)';
        if (summarySpan) {
          summarySpan.textContent = 'IP reservada no asignable';
          summarySpan.className = 'tag-badge amber';
        }
        resultsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--amber-text); padding: 1.5rem;">
          ⚠️ <strong>Conflicto de IP:</strong> La dirección <code>${formatIP(baseNums)}</code> es una ${typeStr} y no puede asignarse como host. Seleccione una IP de host válida (ej. 192.168.0.2).
        </td></tr>`;
        cliOutput.textContent = `# Conflicto de IP: ${formatIP(baseNums)} es una ${typeStr}.\n# Seleccione una dirección de host válida entre .2 y .254 para generar el script CLI.`;
        return;
      }

      // Validación de colisión con IP de fábrica (192.168.0.1) o IP de Staging Host PC (192.168.0.11)
      if (baseNums[0] === 192 && baseNums[1] === 168 && baseNums[2] === 0 && (baseNums[3] === 1 || baseNums[3] === 11)) {
        const reservedName = baseNums[3] === 1 ? 'Switch de fábrica (origen)' : 'Host PC (servidor TFTP de staging)';
        if (summarySpan) {
          summarySpan.textContent = `Conflicto: 192.168.0.${baseNums[3]} reservada`;
          summarySpan.className = 'tag-badge amber';
        }
        resultsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--amber-text); padding: 1.5rem;">
          ⚠️ <strong>Conflicto de IP:</strong> La dirección <code>192.168.0.${baseNums[3]}</code> está reservada para el <strong>${reservedName}</strong>. Ajuste la IP inicial o la cantidad para evitar colisiones.
        </td></tr>`;
        cliOutput.textContent = `# Conflicto de IP: la dirección 192.168.0.1 está reservada para el Switch de fábrica y 192.168.0.11 para el Host PC.\n# Ajuste la IP inicial o la cantidad para evitar colisiones y generar el script CLI.`;
        return;
      }

      if (isNaN(count) || count < 1) count = 1;
      if (count > 64) count = 64;
      countInput.value = count;

      const switches = [];
      const skippedIPs = [];
      let currentOctet4 = baseNums[3];
      const octetPrefix = `${baseNums[0]}.${baseNums[1]}.${baseNums[2]}`;

      for (let i = 0; i < count; i++) {
        let candidateIP = `${octetPrefix}.${currentOctet4}`;

        // Saltar IPs reservadas de fábrica (192.168.0.1) y Host PC (192.168.0.11) en la subred 192.168.0.x
        while (baseNums[0] === 192 && baseNums[1] === 168 && baseNums[2] === 0 &&
               (candidateIP === '192.168.0.1' || candidateIP === '192.168.0.11') && currentOctet4 <= 254) {
          skippedIPs.push(candidateIP);
          currentOctet4++;
          candidateIP = `${octetPrefix}.${currentOctet4}`;
        }

        if (currentOctet4 > 254) break;

        switches.push({
          id: i + 1,
          name: `Switch S600 #${i + 1}`,
          ip: candidateIP,
          factoryIP: '192.168.0.1',
          mask: '255.255.255.0',
          vlan: 'VLAN 1'
        });
        currentOctet4++;
      }

      if (switches.length === 0) {
        if (summarySpan) {
          summarySpan.textContent = 'Sin IPs disponibles en rango';
          summarySpan.className = 'tag-badge amber';
        }
        resultsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--amber-text); padding: 1.5rem;">No hay direcciones de host disponibles en el rango especificado (límite .254 alcanzado).</td></tr>';
        cliOutput.textContent = '# No hay direcciones disponibles en el rango especificado.';
        return;
      }

      const endIP = switches[switches.length - 1].ip;
      if (summarySpan) {
        summarySpan.className = 'tag-badge cyan';
        const skipNote = skippedIPs.length > 0 ? ` (${skippedIPs.join(', ')} omitida por reserva)` : '';
        summarySpan.textContent = `${switches[0].ip} ➔ ${endIP} (${switches.length} switches asignables${skipNote})`;
      }

      // Render tabla
      resultsTbody.innerHTML = '';
      switches.forEach(sw => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${sw.id}</strong></td>
          <td>${sw.name}</td>
          <td><span class="tag-badge emerald">${sw.ip}</span></td>
          <td>${sw.mask}</td>
          <td><span class="tag-badge blue">${sw.vlan}</span></td>
        `;
        resultsTbody.appendChild(tr);
      });

      // Generar script CLI de aprovisionamiento
      let cliText = `# Script CLI autogenerado para Lote S600 (${switches.length} switches)\n# Conecte cada switch al Puerto 1 y aplique:\n`;
      if (skippedIPs.length > 0) {
        cliText += `# NOTA: Se omitieron automáticamente las IPs reservadas [${skippedIPs.join(', ')}] para proteger el Switch de fábrica y el Host PC.\n`;
      }
      cliText += '\n';

      switches.forEach(sw => {
        cliText += `# Switch #${sw.id} [${sw.ip}]\n`;
        cliText += `enable\nconfigure terminal\ninterface vlan1\nip address ${sw.ip} ${sw.mask}\nexit\nexit\nwrite\nY\n\n`;
      });
      cliOutput.textContent = cliText.trim();
    }

    // Eventos
    startIpInput.addEventListener('input', calculate);
    countInput.addEventListener('input', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      calculate();
    });

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        countInput.value = btn.dataset.count;
        calculate();
      });
    });

    calculate();
  }

  // --- 5. Simulador Interactivo Paso 1: Asignación Secuencial ---
  function initSimulatorPaso1() {
    const startBtn = document.getElementById('sim-p1-start');
    const resetBtn = document.getElementById('sim-p1-reset');
    const container = document.getElementById('sim-p1-cards');
    const consoleEl = document.getElementById('sim-p1-console');
    const statusDot = document.getElementById('sim-p1-dot');
    const statusText = document.getElementById('sim-p1-status-text');

    if (!startBtn || !resetBtn || !container || !consoleEl) return;

    let step1Timeouts = [];

    function clearAllStep1Timeouts() {
      step1Timeouts.forEach(id => clearTimeout(id));
      step1Timeouts = [];
      state.simPaso1.timer = null;
    }

    function scheduleStep1Timeout(fn, delay) {
      const id = setTimeout(() => {
        step1Timeouts = step1Timeouts.filter(t => t !== id);
        if (!state.simPaso1.running) return;
        fn();
      }, delay);
      step1Timeouts.push(id);
      state.simPaso1.timer = id;
      return id;
    }

    let switches = [
      { id: 1, ip: '192.168.0.2', mac: '00:E0:4C:68:01:A1', status: 'pending', label: '⏳ Esperando conexión en Puerto 1' },
      { id: 2, ip: '192.168.0.3', mac: '00:E0:4C:68:02:B2', status: 'pending', label: '⏳ En cola' },
      { id: 3, ip: '192.168.0.4', mac: '00:E0:4C:68:03:C3', status: 'pending', label: '⏳ En cola' },
      { id: 4, ip: '192.168.0.5', mac: '00:E0:4C:68:04:D4', status: 'pending', label: '⏳ En cola' }
    ];

    function appendLog(type, msg) {
      const d = new Date();
      const timeStr = `[${d.toTimeString().split(' ')[0]}]`;
      const div = document.createElement('div');
      div.className = 'sim-log-line';
      let tagClass = 'sim-log-info';
      let tag = '[INFO]';

      if (type === 'success') { tagClass = 'sim-log-success'; tag = '[SUCCESS]'; }
      if (type === 'warn') { tagClass = 'sim-log-warn'; tag = '[PROMPT]'; }
      if (type === 'err') { tagClass = 'sim-log-err'; tag = '[ERROR]'; }

      div.innerHTML = `<span class="sim-log-time">${timeStr}</span> <span class="${tagClass}">${tag}</span> ${msg}`;
      consoleEl.appendChild(div);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function renderCards() {
      container.innerHTML = '';
      switches.forEach(sw => {
        const card = document.createElement('div');
        let cardClass = 'sim-switch-card';
        if (sw.status === 'active') cardClass += ' active';
        if (sw.status === 'success') cardClass += ' success';

        card.className = cardClass;
        card.innerHTML = `
          <div class="sim-switch-head">
            <span class="sim-switch-ip">Switch #${sw.id}</span>
            <span class="tag-badge ${sw.status === 'success' ? 'emerald' : (sw.status === 'active' ? 'blue' : 'amber')}">
              ${sw.ip}
            </span>
          </div>
          <div class="sim-switch-stage">${sw.label}</div>
          <div class="sim-progress-track">
            <div class="sim-progress-fill ${sw.status === 'success' ? 'complete' : ''}" style="width: ${sw.progress || 0}%"></div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function runStep() {
      if (!state.simPaso1.running) return;

      if (state.simPaso1.currentIndex >= switches.length) {
        state.simPaso1.running = false;
        startBtn.textContent = '⚡ Iniciar Simulación Paso 1';
        startBtn.disabled = false;
        if (statusDot) statusDot.className = 'sim-status-dot';
        if (statusText) statusText.textContent = 'Lote completado con éxito. Todos los switches tienen IP.';
        appendLog('success', '✔ PASO 1 CULMINADO: 4/4 switches configurados y guardados en Flash.');
        playSoundSuccess();
        return;
      }

      const sw = switches[state.simPaso1.currentIndex];
      sw.status = 'active';

      // Etapa 1: Ping y Mutex
      sw.label = '⚙ Detectado en 192.168.0.1 (Adquiriendo _BASE_IP_LOCK)...';
      sw.progress = 25;
      renderCards();
      appendLog('info', `Switch #${sw.id} detectado en 192.168.0.1. Limpiando ARP (arp -d)...`);

      scheduleStep1Timeout(() => {
        if (!state.simPaso1.running) return;
        // Etapa 2: SSH y Cambio IP
        sw.label = `⚙ Enviando comandos CLI: VLAN 1 ➔ ${sw.ip}/24...`;
        sw.progress = 55;
        renderCards();
        appendLog('info', `SSH autenticado admin/admin. Asignando IP ${sw.ip}/24 en VLAN 1...`);

        scheduleStep1Timeout(() => {
          if (!state.simPaso1.running) return;
          // Etapa 3: Persistencia Flash
          sw.label = '⚙ Guardando en memoria Flash (write)...';
          sw.progress = 85;
          renderCards();
          appendLog('info', `Ejecutando orden "write"... Respuesta: [OK] Configuration saved.`);

          scheduleStep1Timeout(() => {
            if (!state.simPaso1.running) return;
            // Etapa 4: Culminación y Prompt
            sw.status = 'success';
            sw.label = `✔ Configurado OK [${sw.ip}]`;
            sw.progress = 100;
            renderCards();

            appendLog('success', `Switch #${sw.id} (${sw.ip}) guardado exitosamente.`);
            appendLog('warn', `🔊 PROMPT: Desconecte Switch #${sw.id} del Puerto 1 y conecte el siguiente.`);
            playSoundPrompt();

            state.simPaso1.currentIndex++;
            scheduleStep1Timeout(runStep, 1800);
          }, 800);
        }, 800);
      }, 700);
    }

    startBtn.addEventListener('click', () => {
      if (state.simPaso1.running) return;
      clearAllStep1Timeouts();
      state.simPaso1.running = true;
      state.simPaso1.currentIndex = 0;
      startBtn.disabled = true;
      if (statusDot) statusDot.className = 'sim-status-dot running';
      if (statusText) statusText.textContent = 'Simulador en ejecución: conecte switches uno a uno...';
      appendLog('info', 'Iniciando secuencia de asignación de IPs (Paso 1)...');
      runStep();
    });

    resetBtn.addEventListener('click', () => {
      clearAllStep1Timeouts();
      state.simPaso1.running = false;
      state.simPaso1.currentIndex = 0;
      startBtn.disabled = false;
      startBtn.textContent = '⚡ Iniciar Simulación Paso 1';
      if (statusDot) statusDot.className = 'sim-status-dot';
      if (statusText) statusText.textContent = 'En espera. Presione iniciar para simular la secuencia.';
      consoleEl.innerHTML = '<div class="sim-log-line"><span class="sim-log-time">[00:00:00]</span> <span class="sim-log-info">[INFO]</span> Simulador reiniciado. Listo para iniciar.</div>';
      switches = [
        { id: 1, ip: '192.168.0.2', mac: '00:E0:4C:68:01:A1', status: 'pending', label: '⏳ Esperando conexión en Puerto 1' },
        { id: 2, ip: '192.168.0.3', mac: '00:E0:4C:68:02:B2', status: 'pending', label: '⏳ En cola' },
        { id: 3, ip: '192.168.0.4', mac: '00:E0:4C:68:03:C3', status: 'pending', label: '⏳ En cola' },
        { id: 4, ip: '192.168.0.5', mac: '00:E0:4C:68:04:D4', status: 'pending', label: '⏳ En cola' }
      ];
      renderCards();
    });

    renderCards();
  }

  // --- 6. Simulador Interactivo Paso 2: Flasheo Masivo Concurrente ---
  function initSimulatorPaso2() {
    const startBtn = document.getElementById('sim-p2-start');
    const resetBtn = document.getElementById('sim-p2-reset');
    const container = document.getElementById('sim-p2-cards');
    const consoleEl = document.getElementById('sim-p2-console');
    const globalProgressFill = document.getElementById('sim-p2-global-progress');
    const globalPercent = document.getElementById('sim-p2-global-percent');
    const statusDot = document.getElementById('sim-p2-dot');
    const statusText = document.getElementById('sim-p2-status-text');

    if (!startBtn || !resetBtn || !container || !consoleEl || !globalProgressFill) return;

    let tftpInterval = null;
    let step2Timeouts = [];

    function clearAllStep2Timers() {
      if (tftpInterval) {
        clearInterval(tftpInterval);
        tftpInterval = null;
      }
      step2Timeouts.forEach(id => clearTimeout(id));
      step2Timeouts = [];
      state.simPaso2.timer = null;
    }

    function scheduleStep2Timeout(fn, delay) {
      const id = setTimeout(() => {
        step2Timeouts = step2Timeouts.filter(t => t !== id);
        if (!state.simPaso2.running) return;
        fn();
      }, delay);
      step2Timeouts.push(id);
      state.simPaso2.timer = id;
      return id;
    }

    let switches = [
      { id: 1, ip: '192.168.0.2', progress: 0, stage: 'En espera', status: 'pending' },
      { id: 2, ip: '192.168.0.3', progress: 0, stage: 'En espera', status: 'pending' },
      { id: 3, ip: '192.168.0.4', progress: 0, stage: 'En espera', status: 'pending' },
      { id: 4, ip: '192.168.0.5', progress: 0, stage: 'En espera', status: 'pending' }
    ];

    function appendLog(type, msg) {
      const d = new Date();
      const timeStr = `[${d.toTimeString().split(' ')[0]}]`;
      const div = document.createElement('div');
      div.className = 'sim-log-line';
      let tagClass = 'sim-log-info';
      let tag = '[INFO]';

      if (type === 'success') { tagClass = 'sim-log-success'; tag = '[SUCCESS]'; }
      if (type === 'warn') { tagClass = 'sim-log-warn'; tag = '[TFTP]'; }
      if (type === 'err') { tagClass = 'sim-log-err'; tag = '[ERROR]'; }

      div.innerHTML = `<span class="sim-log-time">${timeStr}</span> <span class="${tagClass}">${tag}</span> ${msg}`;
      consoleEl.appendChild(div);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function renderCards() {
      container.innerHTML = '';
      switches.forEach(sw => {
        const card = document.createElement('div');
        let cardClass = 'sim-switch-card';
        if (sw.status === 'active') cardClass += ' active';
        if (sw.status === 'success') cardClass += ' success';

        card.className = cardClass;
        card.innerHTML = `
          <div class="sim-switch-head">
            <span class="sim-switch-ip">Switch #${sw.id} (${sw.ip})</span>
            <span class="tag-badge ${sw.status === 'success' ? 'emerald' : 'blue'}">
              ${sw.progress}%
            </span>
          </div>
          <div class="sim-switch-stage">${sw.stage}</div>
          <div class="sim-progress-track">
            <div class="sim-progress-fill ${sw.status === 'success' ? 'complete' : ''}" style="width: ${sw.progress}%"></div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function updateGlobal() {
      const total = switches.reduce((acc, s) => acc + s.progress, 0);
      const avg = Math.floor(total / switches.length);
      globalProgressFill.style.width = `${avg}%`;
      if (globalPercent) globalPercent.textContent = `${avg}%`;
    }

    startBtn.addEventListener('click', () => {
      if (state.simPaso2.running) return;
      clearAllStep2Timers();
      state.simPaso2.running = true;
      startBtn.disabled = true;
      if (statusDot) statusDot.className = 'sim-status-dot running';
      if (statusText) statusText.textContent = 'Flasheo concurrente en progreso (4 hilos paralelos activos)...';

      appendLog('info', 'Iniciando Servidor TFTP RFC 1350 en 0.0.0.0:69 (Caché en RAM: 23.7 MB)');
      appendLog('info', 'Lanzando 4 hilos concurrentes worker_thread(ip)...');

      switches.forEach(sw => {
        sw.status = 'active';
        sw.progress = 5;
        sw.stage = 'Conexión SSH y comando download switch...';
      });
      renderCards();
      updateGlobal();

      // Fase 1: Descarga TFTP RAM (5% a 45%)
      scheduleStep2Timeout(() => {
        if (!state.simPaso2.running) return;
        appendLog('warn', 'Switches solicitando bloques TFTP RFC 1350 (Chunks de 512B vía UDP)');
        tftpInterval = setInterval(() => {
          if (!state.simPaso2.running) {
            clearInterval(tftpInterval);
            tftpInterval = null;
            return;
          }
          let allDone = true;
          switches.forEach(sw => {
            if (sw.progress < 45) {
              sw.progress += Math.floor(Math.random() * 8) + 4;
              if (sw.progress > 45) sw.progress = 45;
              sw.stage = `TFTP RAM Streaming... ${sw.progress * 2}%`;
              allDone = false;
            }
          });
          renderCards();
          updateGlobal();

          if (allDone) {
            clearInterval(tftpInterval);
            tftpInterval = null;
            if (!state.simPaso2.running) return;

            // Fase 2: Grabación en Flash (45% a 70%)
            appendLog('info', 'Descarga completada en RAM. Grabando memoria Flash (~2 min simulados)...');
            switches.forEach(sw => {
              sw.stage = 'Grabando Firmware en Flash ROM...';
              sw.progress = 55;
            });
            renderCards();
            updateGlobal();

            scheduleStep2Timeout(() => {
              if (!state.simPaso2.running) return;
              // Fase 3: Reinicio y Polling ICMP
              appendLog('info', 'Flash grabada. Enviando orden "reboot Y". Vigilando caída de ping...');
              switches.forEach(sw => {
                sw.stage = 'Reinicio Switch (Esperando caída de enlace)...';
                sw.progress = 75;
              });
              renderCards();
              updateGlobal();

              scheduleStep2Timeout(() => {
                if (!state.simPaso2.running) return;
                appendLog('info', 'Enlace recuperado tras boot. Pausa de estabilización de demonios (25s)...');
                switches.forEach(sw => {
                  sw.stage = 'Polling SSH "show version" para verificar v6.9.6...';
                  sw.progress = 90;
                });
                renderCards();
                updateGlobal();

                scheduleStep2Timeout(() => {
                  if (!state.simPaso2.running) return;
                  // Fase 4: Finalizado con Éxito
                  switches.forEach(sw => {
                    sw.status = 'success';
                    sw.progress = 100;
                    sw.stage = '✔ Versión 6.9.6 (9300 7v4) Confirmada';
                  });
                  renderCards();
                  updateGlobal();

                  state.simPaso2.running = false;
                  startBtn.disabled = false;
                  startBtn.textContent = '⚡ Iniciar Flasheo Concurrente';
                  if (statusDot) statusDot.className = 'sim-status-dot';
                  if (statusText) statusText.textContent = '¡Flasheo Masivo Completado con 100% de Éxito!';

                  appendLog('success', '✔ TODOS LOS SWITCHES ACTUALIZADOS A v6.9.6.');
                  appendLog('success', 'Reporte de auditoría CSV y log TXT guardados en Reportes_Lotes/');
                  playSoundSuccess();
                }, 1500);
              }, 1500);
            }, 1200);
          }
        }, 200);
      }, 700);
    });

    resetBtn.addEventListener('click', () => {
      clearAllStep2Timers();
      state.simPaso2.running = false;
      startBtn.disabled = false;
      startBtn.textContent = '⚡ Iniciar Flasheo Concurrente';
      if (statusDot) statusDot.className = 'sim-status-dot';
      if (statusText) statusText.textContent = 'En espera. Presione iniciar para simular la actualización.';
      consoleEl.innerHTML = '<div class="sim-log-line"><span class="sim-log-time">[00:00:00]</span> <span class="sim-log-info">[INFO]</span> Simulador de flasheo listo. Servidor TFTP esperando solicitudes.</div>';
      switches = [
        { id: 1, ip: '192.168.0.2', progress: 0, stage: 'En espera', status: 'pending' },
        { id: 2, ip: '192.168.0.3', progress: 0, stage: 'En espera', status: 'pending' },
        { id: 3, ip: '192.168.0.4', progress: 0, stage: 'En espera', status: 'pending' },
        { id: 4, ip: '192.168.0.5', progress: 0, stage: 'En espera', status: 'pending' }
      ];
      renderCards();
      updateGlobal();
    });

    renderCards();
    updateGlobal();
  }

  // --- 7. Reproductor de Audio Feedback (Soundboard) ---
  function initSoundboard() {
    const btnPrompt = document.getElementById('sound-btn-prompt');
    const btnSuccess = document.getElementById('sound-btn-success');
    const btnWarning = document.getElementById('sound-btn-warning');
    const btnError = document.getElementById('sound-btn-error');
    const muteToggle = document.getElementById('nav-mute-toggle');

    if (btnPrompt) btnPrompt.addEventListener('click', playSoundPrompt);
    if (btnSuccess) btnSuccess.addEventListener('click', playSoundSuccess);
    if (btnWarning) btnWarning.addEventListener('click', playSoundWarning);
    if (btnError) btnError.addEventListener('click', playSoundError);

    if (muteToggle) {
      muteToggle.addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        muteToggle.textContent = state.isMuted ? '🔇' : '🔊';
        muteToggle.setAttribute('title', state.isMuted ? 'Sonido silenciado' : 'Sonido activado');
        muteToggle.setAttribute('aria-label', state.isMuted ? 'Activar audio' : 'Silenciar audio');
        muteToggle.setAttribute('aria-pressed', state.isMuted ? 'true' : 'false');
        muteToggle.classList.toggle('is-muted', state.isMuted);
        showToast(state.isMuted ? 'Audio silenciado' : 'Audio activado', state.isMuted ? 'amber' : 'emerald');
      });
    }
  }

  // --- 8. Modal Lightbox (Vanilla JS) ---
  function initLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const imgEl = document.getElementById('lightbox-img');
    const titleEl = document.getElementById('lightbox-caption-title');
    const descEl = document.getElementById('lightbox-caption-desc');
    const closeBtn = document.getElementById('lightbox-close-btn');

    if (!modal || !imgEl || !closeBtn) return;

    function openModal(src, title, desc) {
      if (!src || typeof src !== 'string' || src.trim() === '' || src === 'undefined' || src === 'null') return;
      imgEl.src = src;
      imgEl.classList.remove('zoomed');
      if (titleEl) titleEl.textContent = title || 'Inspección de Recurso';
      if (descEl) descEl.textContent = desc || '';
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      imgEl.src = '';
    }

    // Delegación para cualquier imagen zoomable
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-zoomable="true"]');
      if (target) {
        const imgInside = target.tagName.toLowerCase() === 'img' ? target : target.querySelector('img');
        const src = target.dataset.fullSrc || (imgInside ? imgInside.getAttribute('src') : target.getAttribute('src'));
        const title = target.dataset.title || (imgInside ? imgInside.getAttribute('alt') : target.getAttribute('alt')) || 'Vista Previa';
        const desc = target.dataset.desc || (imgInside ? imgInside.getAttribute('alt') : '');
        if (src && typeof src === 'string' && src !== 'undefined' && src !== 'null') {
          openModal(src, title, desc);
        }
      }
    });

    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    imgEl.addEventListener('click', () => {
      imgEl.classList.toggle('zoomed');
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // --- 9. Filtro de Galería ---
  function initGalleryFilters() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.dataset.filter;
        galleryItems.forEach(item => {
          if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  // --- 10. Portapapeles & Toast Notifications ---
  function showToast(message, type = 'emerald') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderColor = type === 'emerald' ? 'var(--emerald)' : (type === 'amber' ? 'var(--amber)' : 'var(--blue)');
    toast.innerHTML = `<span>✔</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        let textToCopy = '';

        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl) textToCopy = targetEl.innerText || targetEl.textContent;
        } else if (btn.dataset.clipboardText) {
          textToCopy = btn.dataset.clipboardText;
        }

        if (textToCopy) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
              handleCopySuccess(btn);
            }).catch(() => {
              fallbackCopy(textToCopy, btn);
            });
          } else {
            fallbackCopy(textToCopy, btn);
          }
        }
      });
    });

    function fallbackCopy(text, btn) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        handleCopySuccess(btn);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }

    function handleCopySuccess(btn) {
      const origText = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '<span>✔</span> ¡Copiado!';
      showToast('Comando copiado al portapapeles');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = origText;
      }, 2000);
    }
  }

  // --- 11. Menú Móvil Accesible con Ciclo de Vida ARIA y Animación Suave ---
  function initMobileMenu() {
    const toggle = document.getElementById('nav-mobile-toggle');
    const links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    const navLinks = links.querySelectorAll('.nav-link');

    function openMenu() {
      links.classList.add('mobile-open');
      toggle.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Cerrar menú de navegación');
      toggle.textContent = '✕';
      document.body.classList.add('menu-open');
    }

    function closeMenu() {
      if (!links.classList.contains('mobile-open')) return;
      links.classList.remove('mobile-open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú de navegación');
      toggle.textContent = '☰';
      document.body.classList.remove('menu-open');
    }

    function toggleMenu() {
      if (links.classList.contains('mobile-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Cerrar al hacer clic en cualquier enlace de navegación
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Cerrar al hacer clic fuera del menú o del botón toggle
    document.addEventListener('click', (e) => {
      if (links.classList.contains('mobile-open')) {
        if (!links.contains(e.target) && !toggle.contains(e.target)) {
          closeMenu();
        }
      }
    });

    // Cerrar con la tecla Escape y retornar el foco al botón toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('mobile-open')) {
        closeMenu();
        toggle.focus();
      }
    });

    // Cerrar automáticamente si la ventana se amplía por encima del breakpoint móvil
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 1280 && links.classList.contains('mobile-open')) {
          closeMenu();
        }
      }, 100);
    });
  }

  // --- 12. Active Link Highlighting (ScrollSpy) ---
  function initScrollSpy() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = [];

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        const section = document.querySelector(href);
        if (section) sections.push({ link, section });
      }
    });

    if (sections.length === 0 || !('IntersectionObserver' in window)) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -65% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = '#' + entry.target.getAttribute('id');
          sections.forEach(item => {
            if (item.link.getAttribute('href') === id) {
              item.link.classList.add('active');
            } else {
              item.link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(item => observer.observe(item.section));
  }

  // --- 13. Inicialización General al Cargar DOM ---
  document.addEventListener('DOMContentLoaded', () => {
    initArchVisualizer();
    initSubnetCalculator();
    initSimulatorPaso1();
    initSimulatorPaso2();
    initSoundboard();
    initLightbox();
    initGalleryFilters();
    initCopyButtons();
    initMobileMenu();
    initScrollSpy();
  });

})();
