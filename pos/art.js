/* 示範菜單用的向量菜色插圖（簡單畫的，不是照片）。店家有照片時，菜單的 img 欄位優先。 */
const bowl = inner => `<circle cx="100" cy="107" r="84" fill="#000" opacity=".28"/><circle cx="100" cy="100" r="84" fill="#f2e9d4"/><circle cx="100" cy="100" r="76" fill="none" stroke="#3b6db3" stroke-width="3"/>${inner}`;
const plate = inner => `<circle cx="100" cy="107" r="84" fill="#000" opacity=".28"/><circle cx="100" cy="100" r="84" fill="#f6f3ec"/><circle cx="100" cy="100" r="70" fill="#e9e4d6"/><circle cx="100" cy="100" r="63" fill="#f6f3ec"/>${inner}`;
const R = (x,y,w,h,rot,fill,stroke="none",rx) => `<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${rx??h/2.6}" fill="${fill}" stroke="${stroke}" stroke-width="2" transform="translate(${x} ${y}) rotate(${rot})"/>`;
const D = (arr,r,fill,op=1) => arr.map(([x,y,rr])=>`<circle cx="${x}" cy="${y}" r="${rr??r}" fill="${fill}" opacity="${op}"/>`).join("");
const onions = a => a.map(([x,y,r])=>R(x,y,9,3.4,r,"#6fbe5e")).join("");
const chord = y => Math.sqrt(Math.max(0,66*66-(y-100)**2));

const rnd = n => { const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); };
const scatter = (n,rad,seed,fn) => Array.from({length:n},(_,k)=>{ const a=rnd(seed+k*2)*6.2832, r=Math.sqrt(rnd(seed+k*2+1))*rad; return fn(100+Math.cos(a)*r,100+Math.sin(a)*r,Math.round(rnd(seed+k*5)*180-90),k); }).join("");
const leaf = (x,y,r,f="#3f9a3b") => `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="13" ry="7" fill="${f}" stroke="#2c7430" stroke-width="1.4"/><path d="M-11 0H11" stroke="#a9d98f" stroke-width="1.3"/></g>`;
const ART = {
  danfan: () => plate(`<circle cx="100" cy="100" r="58" fill="#e6bd5b"/>`+
    scatter(52,52,3,(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="5.5" ry="2.4" fill="#f6df93" transform="rotate(${r} ${x} ${y})"/>`)+
    scatter(16,50,91,(x,y,r)=>R(x,y,9,5,r,"#fff3b0"))+scatter(9,48,57,(x,y,r)=>R(x,y,6.5,6.5,r,"#9b5a2b",undefined,1.5))+
    scatter(14,50,23,(x,y,r)=>R(x,y,8,3.2,r,"#6fbe5e"))),
  chaomian: () => plate(`<circle cx="100" cy="100" r="60" fill="#f0d489"/>`+
    [62,76,90,104,118,132,142].map((y,i)=>{const c=Math.sqrt(Math.max(0,58*58-(y-100)**2))-4;return `<path d="M${100-c} ${y} q ${c/2} ${i%2?-12:12} ${c} 0 t ${c} 0" fill="none" stroke="#dfae4f" stroke-width="6" stroke-linecap="round"/>`}).join("")+
    scatter(9,46,11,(x,y,r)=>R(x,y,16,9,r,"#b9dc8a","#8fb963",3))+scatter(8,46,29,(x,y,r)=>R(x,y,18,3.6,r,"#8b4b22"))+scatter(7,46,41,(x,y,r)=>R(x,y,14,3.4,r,"#e8873a"))),
  rice: () => bowl(`<circle cx="100" cy="100" r="66" fill="#fbf8f0"/><circle cx="100" cy="98" r="50" fill="#fff"/>`+
    scatter(40,48,5,(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="6" ry="2.6" fill="#efe9d8" transform="rotate(${r} ${x} ${y})"/>`)),
  sanbei: () => bowl(`<circle cx="100" cy="100" r="66" fill="#7a3f1a"/>`+
    [[78,78,-20],[118,80,24],[132,108,-10],[104,126,16],[72,112,34],[96,100,-40]].map(([x,y,r])=>R(x,y,34,24,r,"#a85b22","#6e3412",9)+R(x-4,y-4,14,7,r,"#c9803a",undefined,3)).join("")+
    [[88,92,20],[114,98,-30],[100,70,70],[124,124,10],[76,126,-50],[134,84,40],[96,134,60]].map(([x,y,r])=>leaf(x,y,r)).join("")+
    D([[90,116,6],[116,114,6],[78,94,5]],0,"#f1e6c4")+`<circle cx="130" cy="136" r="10" fill="#e8d28a" stroke="#c4aa56" stroke-width="2"/><circle cx="72" cy="140" r="9" fill="#e8d28a" stroke="#c4aa56" stroke-width="2"/>`+
    R(106,88,16,5,30,"#d83a24")+R(84,134,16,5,-40,"#d83a24")+R(122,100,14,5,70,"#d83a24")),
  beef: () => plate(
    scatter(22,52,17,(x,y,r)=>R(x,y,22,7,r,"#e5efb5","#9bc46a",3))+
    [[84,86,-25],[118,92,30],[92,118,10],[122,120,-30],[102,100,50],[74,108,-60]].map(([x,y,r])=>R(x,y,36,17,r,"#7b3b1d","#4e2410",8)+R(x-5,y-3,14,5,r,"#a35a30",undefined,2)).join("")+
    [[110,76,0],[76,126,0],[128,104,0]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#e8c46a" stroke-width="3.4"/>`).join("")+
    scatter(14,50,63,(x,y,r)=>R(x,y,12,4,r,"#58a84a"))),
  kongxin: () => ART.qing(),
  kugua: () => plate(
    [[78,82],[110,76],[130,104],[104,118],[74,114],[96,96]].map(([x,y],k)=>`<circle cx="${x}" cy="${y}" r="17" fill="#a3c57d" stroke="#6f9a4d" stroke-width="2"/><circle cx="${x}" cy="${y}" r="9" fill="#dcedc0"/><circle cx="${x}" cy="${y}" r="4" fill="#bcd99c"/>`).join("")+
    scatter(26,52,7,(x,y)=>`<circle cx="${x}" cy="${y}" r="3.4" fill="#f2b632"/>`)+scatter(10,50,19,(x,y)=>`<circle cx="${x}" cy="${y}" r="2.6" fill="#fff4cc"/>`)),
  caipu: () => plate(`<path d="M42 104 C42 70 78 56 112 58 C148 60 160 84 156 108 C152 134 118 146 86 142 C56 138 42 124 42 104Z" fill="#f3c344" stroke="#d09a1e" stroke-width="3"/><path d="M60 110 C84 90 120 90 146 106" fill="none" stroke="#dba52a" stroke-width="3" stroke-linecap="round"/>`+
    scatter(18,40,3,(x,y,r)=>R(x,y+2,8,4.4,r,"#8b5a2b","#6a4219",1.6))+scatter(10,40,77,(x,y,r)=>R(x,y+2,8,3,r,"#6fbe5e"))+`<ellipse cx="94" cy="76" rx="22" ry="7" fill="#fbe08a" opacity=".8"/>`),
  geli: () => bowl(`<circle cx="100" cy="100" r="66" fill="#e6d5a2"/><circle cx="100" cy="100" r="48" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>`+
    [[80,84,-20],[120,90,30],[96,118,5],[132,122,-35],[70,116,50]].map(([x,y,r])=>`<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="17" ry="12" fill="#eadfc4" stroke="#b59d6a" stroke-width="2"/><path d="M-10 -2 Q0 -9 10 -2 M-12 3 Q0 -6 12 3" fill="none" stroke="#c9b27e" stroke-width="1.8"/></g>`).join("")+
    leaf(104,78,15)+leaf(90,132,-40)+`<circle cx="124" cy="102" r="9" fill="#efe0a3" stroke="#c4aa56" stroke-width="2"/>`),
  gongwan: () => bowl(`<circle cx="100" cy="100" r="66" fill="#e6d5a2"/><circle cx="100" cy="100" r="48" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>`+
    [[82,90],[120,98],[98,126]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="17" fill="#a8744a" stroke="#7c4f2c" stroke-width="2"/>${D([[x-6,y-4],[x+5,y+5],[x+2,y-8],[x-7,y+7]],1.8,"#7c4f2c")}<ellipse cx="${x-6}" cy="${y-8}" rx="5" ry="2.8" fill="#d8b08a" opacity=".8"/>`).join("")+
    scatter(14,50,31,(x,y,r)=>R(x,y,7,3.2,r,"#8b5a2b"))+onions([[104,84,30],[70,112,-20],[132,126,60],[100,108,-60]])),
  dong: () => cup("#b4742f"),
  hong: () => cup("#9e2f1c")
};
ART.qing = () => plate([[78,100,-30,"#4f9a46"],[98,84,10,"#66b257"],[120,100,40,"#3e8a3b"],[90,120,-60,"#66b257"],[112,124,20,"#4f9a46"],[100,102,70,"#3e8a3b"],[70,116,10,"#4f9a46"],[128,120,-20,"#66b257"]].map(([x,y,r,f])=>
      `<ellipse cx="${x}" cy="${y}" rx="26" ry="11" fill="${f}" stroke="#2f7030" stroke-width="1.5" transform="rotate(${r} ${x} ${y})"/><path d="M${x-20} ${y} L${x+20} ${y}" stroke="#b9e0a6" stroke-width="1.5" transform="rotate(${r} ${x} ${y})"/>`).join("")+
    D([[88,96],[104,112],[118,92],[96,126],[80,110],[112,128],[126,108]],2.8,"#efdc9a"));
function cup(color){
  return `<ellipse cx="100" cy="177" rx="42" ry="7" fill="#000" opacity=".3"/>`+
    `<path d="M64 84 L136 84 L126 166 Q100 174 74 166 Z" fill="${color}" opacity=".95"/>`+
    R(88,110,18,18,20,"#fff",undefined,4).replace('fill="#fff"','fill="#fff" opacity=".35"')+R(112,126,18,18,-15,"#fff",undefined,4).replace('fill="#fff"','fill="#fff" opacity=".35"')+R(96,148,18,18,8,"#fff",undefined,4).replace('fill="#fff"','fill="#fff" opacity=".35"')+
    `<path d="M60 56 L140 56 L128 168 Q100 176 72 168 Z" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".55" stroke-width="3"/><ellipse cx="100" cy="56" rx="40" ry="6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>`+
    `<line x1="114" y1="26" x2="104" y2="150" stroke="#ee4b2b" stroke-width="7" stroke-linecap="round"/>`;
}
function comboArt(ids){
  const u=[...new Set(ids)].slice(0,3), pos=u.length===3?[[100,58],[56,138],[144,138]]:u.length===2?[[68,100],[134,100]]:[[100,100]];
  return u.map((id,i)=>`<g transform="translate(${pos[i][0]} ${pos[i][1]}) scale(${u.length===3?.5:.6}) translate(-100 -100)">${ART[id]()}</g>`).join("");
}
const artOf = it => it.items ? comboArt(it.items) : ART[it.id]();
window.POS_ART = { ART, comboArt, artOf };
