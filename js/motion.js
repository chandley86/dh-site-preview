/* Dalton Handley: motion layer (vanilla, no dependencies, about 2 KB)
   - [data-reveal], [data-reveal-stagger]  fade-and-rise when scrolled into view
   - [data-rotate-words="a|b|c"]           rotates words once and rests on the first
   - [data-parallax="0.06"]                gentle parallax for images inside a card
   Respects prefers-reduced-motion. Safe to load more than once. */
(() => {
  if (window.__dhMotion) return; window.__dhMotion = true
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const root = document.documentElement
  if (!reduce && 'IntersectionObserver' in window) root.classList.add('js-motion')

  // Scroll reveal
  const revealables = document.querySelectorAll('[data-reveal], [data-reveal-stagger]')
  document.querySelectorAll('[data-reveal-stagger]').forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--i', i)))
  if (root.classList.contains('js-motion')) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target) } })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 })
    revealables.forEach((el) => {
      // Anything already on screen at load is shown at once, so the first view never flashes
      if (el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add('is-revealed')
      else io.observe(el)
    })
  } else revealables.forEach((el) => el.classList.add('is-revealed'))

  // Rotating word: the first word is the real copy; the cycle ends back on it
  document.querySelectorAll('[data-rotate-words]').forEach((el) => {
    let punct = ''
    const following = el.nextSibling
    if (following && following.nodeType === 3) {
      const m = following.textContent.match(/^(\s*)([.,:;!?]+)/)
      if (m) {
        punct = m[2]
        following.textContent = following.textContent.slice(m[1].length + punct.length)
      }
    }
    const words = el.getAttribute('data-rotate-words').split('|').map((w) => w.trim()).filter(Boolean).map((w) => punct && !/[.,:;!?]$/.test(w) ? w + punct : w)
    if (words.length < 2 || reduce) {
      if (punct && !/[.,:;!?]$/.test(el.textContent.trim())) el.append(punct)
      return
    }
    const bare = (s) => s.replace(/[.,:;!?]+$/, '')
    const visible = el.textContent.trim()
    if (visible && bare(words[0]) !== bare(visible)) words.unshift(punct && !/[.,:;!?]$/.test(visible) ? visible + punct : visible)
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = words[0]
    const box = document.createElement('span'); box.className = 'rw'; box.setAttribute('aria-hidden', 'true')
    const spans = words.map((w, i) => { const s = document.createElement('span'); s.className = 'rw__word'; s.textContent = w; s.dataset.state = i === 0 ? 'in' : 'wait'; box.appendChild(s); return s })
    el.textContent = ''; el.append(sr, box)
    const sequence = [...words.keys(), 0].slice(1) // 1, 2, ... back to 0
    let cur = 0, step = 0
    const hold = Number(el.getAttribute('data-rotate-hold')) || 1900
    const next = () => {
      if (step >= sequence.length) return
      const to = sequence[step++]
      spans[cur].dataset.state = 'out'
      spans[to].dataset.state = 'in'
      const prev = cur; cur = to
      setTimeout(() => { if (prev !== cur) spans[prev].dataset.state = 'wait' }, 820)
      setTimeout(next, to === 0 ? 0 : hold)
    }
    setTimeout(next, Number(el.getAttribute('data-rotate-delay')) || 2600)
  })

  // Gentle parallax
  const px = [...document.querySelectorAll('[data-parallax]')]
  if (px.length && !reduce) {
    let ticking = false
    const update = () => {
      ticking = false
      px.forEach((el) => {
        const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return
        const k = parseFloat(el.dataset.parallax) || 0.06
        const off = (r.top + r.height / 2 - innerHeight / 2) * -k
        el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) scale(1.08)`
      })
    }
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }, { passive: true })
    update()
  }
})()
