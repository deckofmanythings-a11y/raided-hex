// ── Paper doll: composite character portraits from equipment ─────────────────
// Items are procedurally infinite, but their VISUAL dimensions are not: a sprite
// only ever needs to know (class, slot, rarity). So instead of art per item, we
// stack one transparent PNG layer per equipped slot over a class base body, and
// every one of the ~155 possible layers is a static file in art/.
//
// Nothing here needs a schema change or a server round trip -- index.html already
// loads character.class plus every equipped row's items.slot/items.rarity, which
// is exactly the signature a layer stack needs.
//
// Art is authored at SPRITE_W x SPRITE_H logical pixels and displayed at an
// integer multiple with image-rendering:pixelated. Non-integer scaling destroys
// pixel art (it reintroduces the interpolation the whole style exists to avoid),
// so the display size is fixed rather than fluid.

const PaperDoll=(()=>{
  const SPRITE_W=96,SPRITE_H=144;

  // Bumped whenever art/ is regenerated. GitHub Pages and Discord's Activity
  // iframe both cache aggressively, so the sprites carry the same kind of ?v=
  // cache-buster the <script> tags do -- without it a re-generated sprite can
  // keep serving the stale version for ~10 minutes.
  const ART_VERSION='2';

  // Draw order, back to front. Legs/feet go under the chest piece so a long
  // tabard or robe hangs over them; hands sit above the chest (bracers overlap
  // sleeves); the head is above everything body-shaped; the weapon is drawn last
  // because it's held in front of the character.
  const LAYER_ORDER=['legs','feet','chest','hands','head','weapon'];

  // The trinket is deliberately NOT a sprite layer. It's the one class-agnostic
  // slot (see lootgen.ts -- trinkets never carry a class_restriction), it has no
  // natural place on a 96x144 body, and rendering it as a rarity-coloured aura
  // behind the character reads better than a tiny amulet nobody can see anyway.
  const AURA_COLOR={
    common:null, // mundane trinkets don't glow -- an aura should mean something
    uncommon:'rgba(127,217,146,.30)',
    rare:'rgba(127,184,255,.34)',
    epic:'rgba(201,143,255,.38)',
    legendary:'rgba(255,179,71,.44)',
  };

  function bodySrc(classId){return `art/body/${classId}.png?v=${ART_VERSION}`;}
  function gearSrc(classId,slot,rarity){return `art/gear/${classId}/${slot}-${rarity}.png?v=${ART_VERSION}`;}

  // Layers are added optimistically and hidden on error rather than checked
  // against a manifest first. That means the art set can land incrementally --
  // every sprite that exists shows up, every one that doesn't is silently skipped
  // -- with no code change and no manifest to keep in sync. The cost is a 404 per
  // missing file in the network tab, which is harmless and self-resolving.
  function addLayer(stack,src,z){
    const img=document.createElement('img');
    img.className='pd-layer';
    img.style.zIndex=z;
    img.alt='';
    img.decoding='async';
    img.onerror=()=>{img.style.display='none';};
    img.src=src;
    stack.appendChild(img);
    return img;
  }

  function buildStack(classId,equipped,opts={}){
    const wrap=document.createElement('div');
    wrap.className='pd-wrap';
    wrap.style.setProperty('--pd-w',SPRITE_W+'px');
    wrap.style.setProperty('--pd-h',SPRITE_H+'px');
    wrap.style.setProperty('--pd-scale',opts.scale||2);
    if(opts.dead)wrap.classList.add('pd-dead');

    const stack=document.createElement('div');
    stack.className='pd-stack';

    const auraRarity=equipped&&equipped.trinket;
    const aura=auraRarity&&AURA_COLOR[auraRarity];
    if(aura){
      const el=document.createElement('div');
      el.className='pd-aura';
      el.style.background=`radial-gradient(ellipse at 50% 55%, ${aura} 0%, transparent 68%)`;
      stack.appendChild(el);
    }

    // Shown until the base body loads, and left showing if it never does. The
    // art set lands incrementally (sprite-forge exports whatever it has
    // finished), so "no art yet" is a real state the UI has to sit in gracefully
    // rather than a bug -- an empty framed box just reads as broken.
    const empty=document.createElement('div');
    empty.className='pd-empty';
    empty.textContent='⚔';
    stack.appendChild(empty);

    const body=addLayer(stack,bodySrc(classId),1);
    body.addEventListener('load',()=>{empty.style.display='none';});

    LAYER_ORDER.forEach((slot,i)=>{
      const rarity=equipped&&equipped[slot];
      if(!rarity)return;
      addLayer(stack,gearSrc(classId,slot,rarity),2+i);
    });

    wrap.appendChild(stack);
    return wrap;
  }

  // equipped is a plain {slot: rarity} map -- see equippedSignature() below for
  // building one from the inventory rows index.html already holds.
  function render(el,{classId,equipped,dead,scale}={}){
    if(!el)return;
    el.innerHTML='';
    if(!classId)return;
    el.appendChild(buildStack(classId,equipped||{},{dead,scale}));
  }

  // Collapses inventory rows down to the only thing the art cares about. Rows
  // arrive in index.html's shape: {equipped_slot, items:{slot, rarity}}.
  function equippedSignature(inventoryRows){
    const sig={};
    (inventoryRows||[]).forEach(r=>{
      if(!r.equipped_slot)return;
      sig[r.equipped_slot]=r.items&&r.items.rarity;
    });
    return sig;
  }

  return{SPRITE_W,SPRITE_H,ART_VERSION,LAYER_ORDER,render,equippedSignature};
})();
