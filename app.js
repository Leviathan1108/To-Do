const API='api.php';
let todos=[], filter='all';
const $=s=>document.querySelector(s);
const listEl=$('#list'), inputEl=$('#input'), formEl=$('#form');
const statusEl=$('#status'), clearBtn=$('#clear-completed');

function setStatus(msg, ok=true){
  statusEl.textContent=msg;
  statusEl.style.color=ok?'#8b8d98':'#ff6b6b';
  statusEl.style.borderColor=ok?'#2a2e3a':'#ff6b6b40';
}
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(ts){ const d=new Date(Number(ts)); return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

async function fetchTodos(){
  try{
    const r=await fetch(`${API}?filter=${filter}`);
    if(!r.ok) throw new Error(await r.text());
    todos=await r.json();
    setStatus(`DB ok — ${todos.length} row • filter: ${filter}`, true);
    render();
  }catch(e){
    setStatus('DB error: '+e.message, false);
  }
}
function render(){
  listEl.innerHTML='';
  if(!todos.length){
    listEl.innerHTML=`<li class="empty">No ${filter!=='all'?filter:''} todos.</li>`;
  } else {
    for(const t of todos){
      const done=Number(t.done)===1;
      const li=document.createElement('li');
      li.className='item'+(done?' completed':'');
      li.dataset.id=t.id;
      li.innerHTML=`<button class="check">${done?'✓':''}</button><span class="text">${esc(t.text)}</span><span class="meta">${fmtDate(t.created_at)}</span><button class="del">×</button>`;
      listEl.appendChild(li);
    }
  }
  // counts = fetch all counts separately? hitung dari view saat ini + fetch total via extra request cache
  // simple: hit extra endpoint? untuk now hitung dari todos yang ter-filter — plus fetch total via background
  updateCounts();
}

let totalCache={all:0,active:0,completed:0};
async function updateCounts(){
  try{
    const [all,active,completed]=await Promise.all([
      fetch(API).then(r=>r.json()),
      fetch(API+'?filter=active').then(r=>r.json()),
      fetch(API+'?filter=completed').then(r=>r.json()),
    ]);
    totalCache={all:all.length, active:active.length, completed:completed.length};
  }catch{}
  $('#count-all').textContent=totalCache.all?`· ${totalCache.all}`:'';
  $('#count-active').textContent=totalCache.active?`· ${totalCache.active}`:'';
  $('#count-completed').textContent=totalCache.completed?`· ${totalCache.completed}`:'';
  $('#left-count').textContent=`${totalCache.active} item${totalCache.active!==1?'s':''} left`;
  clearBtn.style.visibility=totalCache.completed?'visible':'hidden';
  document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active', b.dataset.filter===filter));
}

// add
formEl.addEventListener('submit', async e=>{
  e.preventDefault();
  const v=inputEl.value.trim();
  if(!v) return;
  inputEl.value='';
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:v})});
    if(!r.ok) throw new Error(await r.text());
    await fetchTodos();
  }catch(err){ setStatus(err.message,false); }
});

// toggle / delete / edit
listEl.addEventListener('click', async e=>{
  const li=e.target.closest('.item'); if(!li) return;
  const id=li.dataset.id;
  if(e.target.classList.contains('check')){
    const cur=todos.find(t=>t.id===id);
    const next=Number(cur.done)===1?0:1;
    await fetch(`${API}?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({done:next})});
    await fetchTodos();
  } else if(e.target.classList.contains('del')){
    await fetch(`${API}?id=${encodeURIComponent(id)}`,{method:'DELETE'});
    await fetchTodos();
  } else if(e.target.classList.contains('text')){
    startEdit(li, todos.find(t=>t.id===id));
  }
});

function startEdit(li, todo){
  const span=li.querySelector('.text');
  const inp=document.createElement('input');
  inp.className='text-input'; inp.value=todo.text; inp.maxLength=255;
  span.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const commit=async()=>{
    if(done) return; done=true;
    const v=inp.value.trim();
    if(!v){
      await fetch(`${API}?id=${encodeURIComponent(todo.id)}`,{method:'DELETE'});
    } else if(v!==todo.text){
      await fetch(`${API}?id=${encodeURIComponent(todo.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:v})});
    }
    await fetchTodos();
  };
  const cancel=()=>fetchTodos();
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel(); });
  inp.addEventListener('blur', commit);
}

document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click', async()=>{
  filter=b.dataset.filter;
  document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));
  await fetchTodos();
}));
clearBtn.addEventListener('click', async()=>{
  await fetch(API+'?clear=completed',{method:'DELETE'});
  await fetchTodos();
});

fetchTodos();
