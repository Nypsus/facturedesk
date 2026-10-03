/* ==========================================================================
   MOUVEMENT PILOTÉ PAR LE SCROLL — moteur GSAP + ScrollTrigger + Lenis
   (vendorisés localement dans assets/vendor/). Un seul moteur : défilement
   fluide (Lenis), barre de progression, timeline scrubée du hero, scènes
   épinglées (pin + scrub) dont une section qui glisse par-dessus la suivante,
   cascades de révélation par masque, parallaxe multi-plans, compteurs animés,
   halo de hero. Replis : sans GSAP → IntersectionObserver ; sans JS ou
   prefers-reduced-motion → contenu immédiatement visible (CSS + <noscript>).
   ========================================================================== */
var FDK_REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function animateTo(el,to,fmt,dur){
  if(!el) return;
  fmt=fmt||function(v){ return String(Math.round(v)); };
  if(FDK_REDUCED){ el.textContent=fmt(to); return; }
  dur=dur||900;
  var t0=performance.now();
  (function loop(ts){
    var k=Math.min(1,(ts-t0)/dur);
    var e=1-Math.pow(1-k,3);
    el.textContent=fmt(to*e);
    if(k<1) requestAnimationFrame(loop); else el.textContent=fmt(to);
  })(performance.now());
}
(function(){
  var doc=document.documentElement;
  var rv=[].slice.call(document.querySelectorAll('.rv,.rv-stagger'));
  var counts=[].slice.call(document.querySelectorAll('.count'));
  var prog=document.getElementById('prog');
  var glow=document.querySelector('header');

  function fmtCount(el,val){
    var dec=parseInt(el.getAttribute('data-dec')||'0',10);
    var s=dec?val.toFixed(dec):String(Math.round(val));
    if(el.getAttribute('data-group')) s=Number(s).toLocaleString('fr-FR');
    el.textContent=s;
  }
  function runCount(el){
    var to=parseFloat(el.getAttribute('data-to'))||0;
    var t0=performance.now();
    (function loop(ts){ var k=Math.min(1,(ts-t0)/950); var e=1-Math.pow(1-k,3); fmtCount(el,to*e); if(k<1) requestAnimationFrame(loop); else fmtCount(el,to); })(performance.now());
  }
  function glowPointer(){
    if(!glow||FDK_REDUCED) return;
    glow.addEventListener('pointermove',function(e){
      var r=glow.getBoundingClientRect();
      glow.style.setProperty('--mx',(((e.clientX-r.left)/r.width)*100).toFixed(2)+'%');
      glow.style.setProperty('--my',(e.clientY-r.top).toFixed(0)+'px');
    });
    glow.addEventListener('pointerleave',function(){
      glow.style.setProperty('--mx','50%'); glow.style.setProperty('--my','10px');
    });
  }

  var hasGSAP = !!(window.gsap && window.ScrollTrigger && window.Lenis);
  if(FDK_REDUCED || !hasGSAP){ fallback(); } else { engine(); }

  /* ---------- repli : sans GSAP, ou mouvement réduit ---------- */
  function fallback(){
    if(FDK_REDUCED||!('IntersectionObserver' in window)){
      rv.forEach(function(el){ el.classList.add('in'); });
    }else{
      var io=new IntersectionObserver(function(entries){
        entries.filter(function(e){ return e.isIntersecting; }).forEach(function(en,i){
          en.target.style.transitionDelay=(Math.min(i,5)*85)+'ms';
          en.target.classList.add('in'); io.unobserve(en.target);
        });
      },{threshold:.12,rootMargin:'0px 0px -6% 0px'});
      rv.forEach(function(el){ io.observe(el); });
      setTimeout(function(){ rv.forEach(function(el){ el.classList.add('in'); }); },4200);
    }
    var pending=FDK_REDUCED?[]:counts.slice();
    if(!FDK_REDUCED) counts.forEach(function(el){ fmtCount(el,0); });
    var ticking=false;
    function frame(){
      ticking=false;
      var y=window.scrollY||window.pageYOffset||0;
      var h=(doc.scrollHeight||document.body.scrollHeight)-window.innerHeight;
      if(prog) prog.style.transform='scaleX('+(h>0?Math.max(0,Math.min(1,y/h)):0)+')';
      if(!FDK_REDUCED){
        var vh=window.innerHeight;
        [].slice.call(document.querySelectorAll('.photo img')).forEach(function(img){
          if(img.closest('header')||img.closest('#example')) return;
          var r=img.parentNode.getBoundingClientRect();
          if(r.bottom<-60||r.top>vh+60) return;
          var mid=r.top+r.height/2-vh/2, f=Math.max(-1,Math.min(1,mid/vh));
          img.style.transform='translate3d(0,'+(-f*16).toFixed(2)+'px,0) scale(1.06)';
        });
      }
      if(glow){ var gi=Math.max(0,1-y/700); glow.style.setProperty('--gi',(0.10+0.15*gi).toFixed(3)); }
      pending=pending.filter(function(el){
        var r=el.getBoundingClientRect();
        if(r.top<window.innerHeight*0.9){ runCount(el); return false; }
        return true;
      });
    }
    function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
    frame();
    glowPointer();
  }

  /* ---------- moteur Asgard : GSAP + ScrollTrigger + Lenis ---------- */
  function engine(){
    var g=window.gsap, ST=window.ScrollTrigger;
    g.registerPlugin(ST);
    g.defaults({ease:'power3.out',duration:.85});
    doc.style.scrollBehavior='auto';

    /* Lenis : défilement fluide, son RAF dans le ticker GSAP (synchro ScrollTrigger) */
    var lenis=new window.Lenis({lerp:.09,smoothWheel:true,wheelMultiplier:.9,anchors:true});
    window.__fdkLenis=lenis;
    lenis.on('scroll',ST.update);
    g.ticker.add(function(t){ lenis.raf(t*1000); ST.update(); });
    g.ticker.lagSmoothing(0);

    /* révélation par masque (clip-path) en cascade — un déclencheur par élément,
       fiable quel que soit le saut de scroll (les batches en rataient) */
    g.utils.toArray('.rv').forEach(function(el){
      var sib=[].slice.call(el.parentNode.children).filter(function(x){ return x.classList.contains('rv'); }).indexOf(el);
      ST.create({trigger:el,start:'top 88%',once:true,onEnter:function(){
        el.style.transitionDelay=(Math.max(0,Math.min(sib,4))*80)+'ms';
        el.classList.add('in');
      }});
    });
    g.utils.toArray('.rv-stagger').forEach(function(el){
      ST.create({trigger:el,start:'top 88%',once:true,onEnter:function(){ el.classList.add('in'); }});
    });
    setTimeout(function(){
      rv.forEach(function(el){ if(el.getBoundingClientRect().top<window.innerHeight*0.98) el.classList.add('in'); });
    },3000);

    /* compteurs animés */
    if(counts.length){
      counts.forEach(function(el){ fmtCount(el,0); });
      g.utils.toArray('.count').forEach(function(el){
        ST.create({trigger:el,start:'top 92%',once:true,onEnter:function(){ runCount(el); }});
      });
    }

    /* barre de progression de page */
    if(prog){ g.to(prog,{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.3}}); }

    /* halo du hero : intensité asservie au scroll */
    if(glow){
      ST.create({start:0,end:700,onUpdate:function(self){
        glow.style.setProperty('--gi',(0.10+0.15*(1-self.progress)).toFixed(3));
      }});
    }

    /* hero : timeline scrubée — la photo s'approfondit, le texte s'efface */
    var heroPhoto=document.querySelector('header .photo img');
    var tl=g.timeline({scrollTrigger:{trigger:'header',start:'top top',end:'bottom top',scrub:.6}});
    if(heroPhoto) tl.to(heroPhoto,{scale:1.14,yPercent:-4,ease:'none'},0);
    tl.to('header h1',{yPercent:-9,autoAlpha:.32,ease:'none'},0)
      .to('header .sub',{yPercent:-6,autoAlpha:.38,ease:'none'},0)
      .to('header .eyebrow',{autoAlpha:0,ease:'none'},0);

    /* parallaxe multi-plans des photos (hors hero et hors scène épinglée) */
    g.utils.toArray('.photo img').forEach(function(img){
      if(img.closest('header')||img.closest('#example')) return;
      var frame=img.closest('.photo')||img;
      g.fromTo(img,{yPercent:-5,scale:1.09},{yPercent:5,scale:1.09,ease:'none',
        scrollTrigger:{trigger:frame,start:'top bottom',end:'bottom top',scrub:1.2,invalidateOnRefresh:true}});
    });

    /* scènes épinglées (desktop uniquement) : pin + scrub,
       dont une section qui glisse par-dessus la précédente */
    var mm=g.matchMedia();
    mm.add('(min-width:900px)',function(){
      var steps=document.getElementById('steps');
      var receive=document.getElementById('receive');
      if(steps){
        ST.create({trigger:steps,start:'top 14%',end:'+=92%',pin:true,pinSpacing:false,
          anticipatePin:1,invalidateOnRefresh:true,scrub:true});
      }
      if(receive && steps){
        g.fromTo(receive,{yPercent:7,scale:.965,autoAlpha:.45},{yPercent:0,scale:1,autoAlpha:1,ease:'none',
          scrollTrigger:{trigger:steps,start:'top 14%',end:'+=92%',scrub:1}});
      }
      var example=document.getElementById('example');
      if(example){
        var exPhoto=example.querySelector('.photo img');
        g.timeline({scrollTrigger:{trigger:example,start:'top 18%',end:'+=70%',
          pin:true,anticipatePin:1,invalidateOnRefresh:true,scrub:1}})
          .fromTo(example.querySelector('.rv'),{xPercent:-6,autoAlpha:.4},{xPercent:0,autoAlpha:1,ease:'none'},0);
        if(exPhoto){
          g.fromTo(exPhoto,{yPercent:-6,scale:1.09},{yPercent:6,scale:1.09,ease:'none',
            scrollTrigger:{trigger:example,start:'top bottom',end:'bottom top',scrub:1.2,invalidateOnRefresh:true}});
        }
      }
    });

    /* recalage après chargement des images / polices */
    window.addEventListener('load',function(){ ST.refresh(); });
    [].slice.call(document.images).forEach(function(img){
      if(!img.complete) img.addEventListener('load',function(){ ST.refresh(); });
    });

    glowPointer();
  }
})();
