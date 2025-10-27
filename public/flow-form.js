(function () {
    class FlowCheckoutForm extends HTMLElement {
      constructor() { super(); this.attachShadow({ mode: 'open' }); this.root = document.createElement('div'); this.shadowRoot.appendChild(this.root); }
      connectedCallback() {
        const apiBase = this.getAttribute('api-base') || '';
        const amountAttr = this.getAttribute('amount');
        const amount = amountAttr ? Number(amountAttr) : 1000;
        const subject = this.getAttribute('subject') || 'Orden Web';
        this.root.innerHTML = `
          <style>
            :host{display:block}
            :root{--bg:#fff;--border:#d9e2ec;--text:#243b53;--muted:#829ab1;--accent:#1f7ae0;--accent-2:#1461b6;--error:#c81e1e;--radius:10px}
            .wrap{max-width:720px;margin:20px auto;padding:4px}
            form{background:var(--bg)}
            .field,.group{display:block;margin:14px 0}
            .field span,.group legend{display:block;font-size:14px;color:var(--muted);margin-bottom:6px}
            .field.required span::after{content:" *";color:var(--accent)}
            input[type="text"],input[type="email"],input[type="tel"],select{width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:15px;color:var(--text);outline:none;background:#fff;transition:box-shadow .2s,border-color .2s}
            input:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(31,122,224,.15)}
            .radio{display:flex;align-items:center;gap:8px;margin:6px 0;color:var(--text)}
            .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
            @media (max-width:640px){.grid2{grid-template-columns:1fr}}
            .btn{background:var(--accent);color:#fff;border:none;padding:12px 18px;border-radius:999px;font-weight:600;cursor:pointer;transition:background .2s,transform .02s;box-shadow:0 8px 20px rgba(31,122,224,.15)}
            .btn:hover{background:var(--accent-2)} .btn:active{transform:translateY(1px)}
            .actions{display:flex;align-items:center;gap:12px;margin-top:14px}
            .msg{font-size:14px;color:var(--muted)} .error{color:var(--error)}
          </style>
          <div class="wrap">
            <form id="f" novalidate>
              <fieldset class="group">
                <legend>Selecciona tu tipo de Rut*</legend>
                <label class="radio"><input type="radio" name="tipoRut" value="juridica" checked> Rut Empresa (Persona Jurídica)</label>
                <label class="radio"><input type="radio" name="tipoRut" value="natural"> Rut Persona (Persona Natural)</label>
              </fieldset>
              <label class="field"><span>Nombre y Apellido</span><input type="text" name="nombre" autocomplete="name" placeholder="Nombre y Apellido"></label>
              <label class="field required"><span>Nombre Empresa*</span><input type="text" name="empresa" required placeholder="Tu empresa SpA"></label>
              <div class="grid2">
                <label class="field required"><span>RUT Personal*</span><input type="text" name="rutPersonal" required placeholder="12.345.678-9"></label>
                <label class="field"><span>RUT Empresa</span><input type="text" name="rutEmpresa" placeholder="77.123.456-0"></label>
              </div>
              <div class="grid2">
                <label class="field required"><span>Email*</span><input type="email" name="email" required placeholder="correo@dominio.cl" autocomplete="email"></label>
                <label class="field required"><span>Número de teléfono: +569 *</span><input type="tel" name="telefono" required placeholder="+569XXXXXXXX" inputmode="tel"></label>
              </div>
              <label class="field required"><span>¿En qué región se encuentra la dirección tributaria?*</span>
                <select name="region" required>
                  <option value="">Selecciona</option>
                  <option>Arica y Parinacota</option><option>Tarapacá</option><option>Antofagasta</option><option>Atacama</option>
                  <option>Coquimbo</option><option>Valparaíso</option><option>Metropolitana de Santiago</option><option>O’Higgins</option>
                  <option>Maule</option><option>Ñuble</option><option>Biobío</option><option>La Araucanía</option>
                  <option>Los Ríos</option><option>Los Lagos</option><option>Aysén</option><option>Magallanes y Antártica</option>
                </select>
              </label>
              <label class="field"><span>Comuna</span><input type="text" name="comuna" placeholder="Ej: Santiago"></label>
              <fieldset class="group"><legend>Género</legend>
                <label class="radio"><input type="radio" name="genero" value="Femenino"> Femenino</label>
                <label class="radio"><input type="radio" name="genero" value="Masculino"> Masculino</label>
              </fieldset>
              <label class="field required"><span>¿Cuántas personas trabajan en su empresa?*</span>
                <select name="empleados" required>
                  <option value="">Selecciona</option>
                  <option value="1-9">1 - 9</option><option value="10-49">10 - 49</option><option value="50-199">50 - 199</option><option value="200+">200 o más</option>
                </select>
              </label>
              <label class="field required"><span>Selecciona el rubro al cual pertenece*</span>
                <select name="rubro" required>
                  <option value="">Selecciona</option>
                  <option>Comercio</option><option>Servicios</option><option>Manufactura</option><option>Construcción</option>
                  <option>Transporte/Logística</option><option>Agro/Alimentos</option><option>Tecnología</option><option>Otro</option>
                </select>
              </label>
              <div class="actions"><button type="submit" class="btn">Enviar</button><div class="msg" id="m" role="status" aria-live="polite"></div></div>
            </form>
          </div>`;
  
        const $ = s => this.shadowRoot.querySelector(s);
        const form = $('#f'); const m = $('#m');
        const regionSel = this.shadowRoot.querySelector('select[name="region"]');
        const comunaInput = this.shadowRoot.querySelector('input[name="comuna"]');
        const comunaSelect = document.createElement('select');
        comunaSelect.name = 'comuna'; comunaSelect.required = false; comunaSelect.innerHTML = `<option value="">Selecciona</option>`; comunaInput.replaceWith(comunaSelect);
        let comunasByRegion = {};
        async function loadComunas() {
          try { const res = await fetch('/comunas.json', { cache: 'force-cache' }); comunasByRegion = await res.json(); }
          catch { comunasByRegion = { 'Metropolitana de Santiago': ['Santiago','Providencia','Las Condes'], 'Valparaíso': ['Valparaíso','Viña del Mar'] }; }
        }
        function fillComunas(region) {
          const list = comunasByRegion[region] || []; comunaSelect.innerHTML = `<option value="">Selecciona</option>` + list.map(c => `<option>${c}</option>`).join('');
        }
        regionSel.addEventListener('change', () => fillComunas(regionSel.value));
        loadComunas().then(() => { if (regionSel.value) fillComunas(regionSel.value); });
  
        const cleanRut = v => (v||'').replace(/[.\s]/g,'').toUpperCase();
        const dvRut = num => { let M=0,S=1; for(;num; num=Math.floor(num/10)) S=(S+num%10*(9-M++%6))%11; return S?String(S-1):'K'; };
        const isRutValid = rut => { rut = cleanRut(rut); const mm = rut.match(/^(\d{1,8})-([\dK])$/i); return !!mm && dvRut(parseInt(mm[1],10))===mm[2].toUpperCase(); };
        const isPhoneValid = v => /^\+569\d{8}$/.test((v||'').replace(/\s/g,''));
        const toast = (t, err=false)=>{ m.textContent=t; m.className = err?'msg error':'msg'; };
        const buildRef = ()=>`REF-${Date.now()}-${Math.floor(Math.random()*9000)+1000}`;
  
        form.addEventListener('submit', async (e) => {
          e.preventDefault(); toast('Procesando…');
          const fd = new FormData(form);
          const tipoRut = fd.get('tipoRut') || 'juridica';
          const nombre = (fd.get('nombre')||'').toString().trim();
          const empresa = (fd.get('empresa')||'').toString().trim();
          const rutPersonal = cleanRut(fd.get('rutPersonal'));
          const rutEmpresa  = cleanRut(fd.get('rutEmpresa'));
          const email = (fd.get('email')||'').toString().trim();
          const telefono = (fd.get('telefono')||'').toString().replace(/\s/g,'');
          const region = fd.get('region')||'';
          const comuna = (fd.get('comuna')||'').toString().trim();
          const genero = fd.get('genero')||'';
          const empleados = fd.get('empleados')||'';
          const rubro = fd.get('rubro')||'';
          if(!empresa) return toast('Falta: Nombre Empresa', true);
          if(!email) return toast('Falta: Email', true);
          if(!telefono || !isPhoneValid(telefono)) return toast('Teléfono inválido (+569XXXXXXXX)', true);
          if(!isRutValid(rutPersonal)) return toast('RUT Personal inválido (12.345.678-9)', true);
          if(!region) return toast('Selecciona Región', true);
          if(!empleados) return toast('Selecciona cantidad de personas', true);
          if(!rubro) return toast('Selecciona Rubro', true);
          const optional = { tipoRut, nombre, empresa, rutPersonal, rutEmpresa, telefono, region, comuna, genero, empleados, rubro, subject: subject || `Servicio ${rubro} - ${empresa}` };
          const reference = buildRef();
          try{
            const r = await fetch(`${apiBase}/api/checkout/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reference, amount, email, optional }) });
            if(!r.ok) throw new Error(await r.text());
            const data = await r.json(); toast('Redirigiendo a Flow…'); window.location.href = data.redirectUrl;
          }catch(err){ console.error(err); toast('No pudimos iniciar el pago. Intenta nuevamente o contáctanos.', true); }
        });
      }
    }
    if (!customElements.get('flow-checkout-form')) customElements.define('flow-checkout-form', FlowCheckoutForm);
  })();