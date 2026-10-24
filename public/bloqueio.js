'use strict';
/* Farol - bloqueio da app neste aparelho (24 out 2026).
 *
 * Ao abrir o Farol (e ao voltar a ele depois de um bocado noutra app), pede
 * o codigo ou o Face ID / impressao digital. Liga-se e desliga-se em Areas ›
 * Definicoes deste aparelho, e vale so para o aparelho onde se ligou.
 *
 * - Codigo: 4 a 8 algarismos. Guarda-se so um resumo (PBKDF2, 150 000
 *   voltas, com sal), nunca o codigo.
 * - Face ID / impressao digital: uma chave de acesso do proprio aparelho
 *   (WebAuthn, autenticador da plataforma, verificacao obrigatoria). O
 *   Farol nao ve a cara nem o dedo: o telemovel so diz «e o dono».
 * - O codigo e sempre obrigatorio (e a porta de recurso se o Face ID falhar).
 * - Cinco codigos errados: espera, cada vez mais longa. «Esqueci o codigo»
 *   termina a sessao: volta-se a entrar com a conta Google e o bloqueio
 *   fica desligado neste aparelho.
 *
 * E um cadeado do aparelho: protege de quem pega no telemovel desbloqueado.
 * O acesso aos dados continua a depender da sessao Google, como sempre.
 *
 * Corre no <head>, antes de a pagina aparecer, para nao se ver nada por
 * baixo do cadeado.
 */
(function(){
  var K = 'farolBloqueio';            // { salt, hash, cred, depois }
  var TEMPO_FORA = 60 * 1000;         // fora mais de 1 minuto: volta a pedir
  function ler(){ try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function gravar(c){ try { if (c) localStorage.setItem(K, JSON.stringify(c)); else localStorage.removeItem(K); } catch (e) {} }

  var cfg = ler();
  if (cfg && cfg.hash) document.documentElement.classList.add('bq-on');

  function b64(buf){ var s = ''; var a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function deB64(t){ var s = atob(t); var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function aleatorio(n){ var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

  function resumo(codigo, sal){
    return crypto.subtle.importKey('raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveBits'])
      .then(function(k){ return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' }, k, 256); })
      .then(b64);
  }

  function temBiometria(){
    return window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function(){ return false; })
      : Promise.resolve(false);
  }

  function criarChave(){
    return navigator.credentials.create({ publicKey: {
      challenge: aleatorio(32),
      rp: { name: 'Farol' },
      user: { id: aleatorio(16), name: 'farol-' + location.hostname, displayName: 'Farol neste aparelho' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none'
    } }).then(function(c){ return b64(c.rawId); });
  }

  function usarChave(id){
    return navigator.credentials.get({ publicKey: {
      challenge: aleatorio(32),
      allowCredentials: [{ type: 'public-key', id: deB64(id), transports: ['internal'] }],
      userVerification: 'required', timeout: 60000
    } }).then(function(a){ return !!a; });
  }

  /* ------------------------- o cadeado ------------------------- */
  var aberto = false;
  function desbloquear(){
    aberto = false;
    var o = document.getElementById('bqCadeado');
    if (o) o.remove();
    document.documentElement.classList.remove('bq-on');
  }
  function falhas(){ try { return JSON.parse(sessionStorage.getItem('bqFalhas') || '{"n":0,"ate":0}'); } catch (e) { return { n: 0, ate: 0 }; } }
  function gravarFalhas(f){ try { sessionStorage.setItem('bqFalhas', JSON.stringify(f)); } catch (e) {} }

  function mostrar(){
    cfg = ler();
    if (!cfg || !cfg.hash || aberto) return;
    aberto = true;
    document.documentElement.classList.add('bq-on');
    var o = document.createElement('div');
    o.id = 'bqCadeado';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-label', 'Farol bloqueado');
    o.innerHTML =
      '<div class="bq-c">' +
      '<div class="bq-farol" aria-hidden="true"></div>' +
      '<h1>Farol</h1><p class="bq-sub">Introduz o código</p>' +
      '<div class="bq-pontos" aria-hidden="true"></div>' +
      '<p class="bq-erro" role="alert"></p>' +
      '<div class="bq-tecl"></div>' +
      '<button type="button" class="bq-bio" hidden></button>' +
      '<button type="button" class="bq-esq">Esqueci o código</button>' +
      '</div>';
    document.body.appendChild(o);
    var codigo = '';
    var pontos = o.querySelector('.bq-pontos');
    var erro = o.querySelector('.bq-erro');
    var desenhar = function(){
      pontos.innerHTML = '';
      for (var i = 0; i < Math.max(4, codigo.length); i++){
        var p = document.createElement('i'); if (i < codigo.length) p.className = 'on'; pontos.appendChild(p);
      }
    };
    var tentar = function(){
      var f = falhas();
      if (f.ate > Date.now()){ erro.textContent = 'Espera ' + Math.ceil((f.ate - Date.now()) / 1000) + ' s.'; codigo = ''; desenhar(); return; }
      resumo(codigo, deB64(cfg.salt)).then(function(h){
        if (h === cfg.hash){ gravarFalhas({ n: 0, ate: 0 }); desbloquear(); return; }
        f.n++;
        if (f.n >= 5) f.ate = Date.now() + Math.min(300, 30 * Math.pow(2, f.n - 5)) * 1000;
        gravarFalhas(f);
        erro.textContent = f.ate > Date.now() ? 'Código errado. Espera ' + Math.ceil((f.ate - Date.now()) / 1000) + ' s.' : 'Código errado.';
        o.querySelector('.bq-pontos').classList.add('abana');
        setTimeout(function(){ o.querySelector('.bq-pontos').classList.remove('abana'); }, 400);
        codigo = ''; desenhar();
      });
    };
    var tecl = o.querySelector('.bq-tecl');
    ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button';
      if (!t){ b.className = 'bq-vazio'; b.disabled = true; b.setAttribute('aria-hidden', 'true'); }
      b.textContent = t;
      if (t === '⌫') b.setAttribute('aria-label', 'Apagar');
      b.addEventListener('click', function(){
        erro.textContent = '';
        if (t === '⌫'){ codigo = codigo.slice(0, -1); desenhar(); return; }
        if (codigo.length >= 8) return;
        codigo += t; desenhar();
        if (codigo.length === (cfg.tam || 4)) tentar();
      });
      tecl.appendChild(b);
    });
    var bio = o.querySelector('.bq-bio');
    var pedirBio = function(){
      usarChave(cfg.cred).then(function(ok){ if (ok) desbloquear(); })
        .catch(function(){ erro.textContent = 'Não deu. Usa o código.'; });
    };
    if (cfg.cred){
      bio.hidden = false;
      bio.textContent = 'Usar Face ID / impressão digital';
      /* O iPhone so deixa pedir o Face ID a partir de um toque: fica o botao. */
      bio.addEventListener('click', pedirBio);
    }
    o.querySelector('.bq-esq').addEventListener('click', function(){
      if (!confirm('Para entrar sem o código, termina-se a sessão e voltas a entrar com a conta Google. O bloqueio fica desligado neste aparelho. Continuar?')) return;
      gravar(null);
      fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(function(){}).then(function(){ location.reload(); });
    });
    document.addEventListener('keydown', function tecla(e){
      if (!document.getElementById('bqCadeado')) { document.removeEventListener('keydown', tecla); return; }
      if (/^[0-9]$/.test(e.key)) { var b = Array.prototype.filter.call(tecl.children, function(x){ return x.textContent === e.key; })[0]; if (b) b.click(); }
      if (e.key === 'Backspace') tecl.lastChild.click();
    });
    desenhar();
  }

  var foraDesde = 0;
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) foraDesde = Date.now();
    else if (foraDesde && Date.now() - foraDesde > TEMPO_FORA) mostrar();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrar); else mostrar();

  /* ------------------------- definicoes ------------------------- */
  window.bqEstado = function(){ var c = ler(); return { ligado: !!(c && c.hash), bio: !!(c && c.cred) }; };
  window.bqTemBiometria = temBiometria;
  /* Ligar: pede o codigo duas vezes e, se o aparelho tiver, oferece o Face ID. */
  window.bqLigar = function(codigo, comBio){
    if (!/^\d{4,8}$/.test(codigo)) return Promise.reject(new Error('O código tem de ter 4 a 8 algarismos.'));
    var sal = aleatorio(16);
    return resumo(codigo, sal).then(function(h){
      var c = { salt: b64(sal), hash: h, tam: codigo.length };
      if (!comBio) { gravar(c); return c; }
      return criarChave().then(function(id){ c.cred = id; gravar(c); return c; })
        .catch(function(){ gravar(c); throw new Error('O código ficou ligado, mas o Face ID / impressão digital não. Podes tentar outra vez.'); });
    });
  };
  window.bqBio = function(){
    var c = ler();
    if (!c || !c.hash) return Promise.reject(new Error('Liga primeiro o código.'));
    return criarChave().then(function(id){ c.cred = id; gravar(c); return c; });
  };
  window.bqDesligar = function(codigo){
    var c = ler();
    if (!c) return Promise.resolve();
    return resumo(codigo || '', deB64(c.salt)).then(function(h){
      if (h !== c.hash) throw new Error('Código errado.');
      gravar(null);
    });
  };
  window.bqAgora = mostrar;
})();
