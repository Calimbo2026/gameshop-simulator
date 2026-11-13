SOLVE = r"""(()=>{const M=GS.Minigames; if(document.querySelector('#mgOk')){document.querySelector('#mgOk').click(); return 'intro';} if(!M.isOpen()||M.isResolving()) return 'idle';
 const q=s=>document.querySelector('#mg '+s), qa=s=>[...document.querySelectorAll('#mg '+s)];
 if(q('.part')){const b=q('.part:not(.used)'); if(!b) return 'pcwait'; if(!b.classList.contains('sel')) b.click(); if(b.classList.contains('flip')) b.click(); q('.pslot[data-id="'+b.dataset.id+'"]').click(); return 'pc';}
 if(q('.dust')){const d=qa('.dust:not(.gone)'); d.slice(0,3).forEach(e=>{e.classList.contains('gone')||document.getElementById('mgFan').dispatchEvent(new KeyboardEvent('x'))}); document.dispatchEvent(new KeyboardEvent('keydown',{key:' '})); return 'pelusa';}
 if(q('#mgSnap')){const m=parseFloat(q('#mgMark').style.left||0), a=parseFloat(q('.ramslot').style.left); if(Math.abs(m-a)<3){q('#mgSnap').click();return 'ram!';} return 'ram';}
 if(q('#mgTape')){document.dispatchEvent(new KeyboardEvent('keydown',{key:' '})); return 'cinta';}
 if(q('#mgNo')&&q('.rowb')){const t=qa('.rowb b').map(x=>x.textContent); const ok=t[0].startsWith('Sí')&&parseInt(t[1])<=10&&!t[2].startsWith('Usado'); q(ok?'#mgYes':'#mgNo').click(); return 'devol';}
 if(q('.rowb')&&q('.expect')){const r=qa('.rowb'); const exp=qa('.expect i').map(x=>x.textContent); const bad=r.find((x,i)=>!x.querySelector('b').textContent.replace(' ✔','').startsWith(exp[i])); (bad||q('#mgYes')).click(); return 'comp';}
 if(document.querySelector('.zone-b')){const z=[...document.querySelectorAll('.zone-b:not(.bad)')]; z[0].click(); return 'repo';}
 if(q('[data-ok="1"]')){q('[data-ok="1"]').click();return 'ok';}
 if(q('.opt[data-id]')){q('.opt[data-id="'+M.customer().product.id+'"]').click();return 'most';}
 if(q('.opt[data-v]')){q('.opt[data-v]:not(.bad)').click();return 'cobro';}
 if(q('.bill')){const bs=qa('.info b').map(b=>parseInt(b.textContent.replace(/\D/g,'')));let ch=bs[1]-bs[0];const v=[20000,10000,2000,1000],bt=qa('.bill');v.forEach((x,i)=>{while(ch>=x){bt[i].click();ch-=x}});q('#mgGive').click();return 'vuelto';}
 if(q('#mgYes')){q('#mgYes').click();return 'comp';}
 return '?';})()"""

import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Juega sola una jornada completa (con interrupciones) hasta el cierre de caja.  Uso: python3 test/v8.py [jornada]
import sys
async def main():
    n = sys.argv[1] if len(sys.argv) > 1 else '4'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':360,'height':560}, device_scale_factor=1)
        pg = await ctx.new_page(); errs=[]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',%s-1); GS.Store.set('quality','baja'); GS.Store.set('testCond','ninguna')" % n)
        await pg.reload(); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.DEBUG_INTR=1"); await pg.click('#btnPlay'); log={}
        for i in range(2600):
            await pg.wait_for_timeout(110)
            st = await pg.evaluate("GS.Game.state()")
            if st=='end': break
            r = await pg.evaluate("(()=>{const i=document.querySelector('[data-intr=\"1\"]'); if(i&&!GS.Minigames.isOpen()){i.click();return 'intr';} if(!GS.Minigames.isOpen()){const j=document.querySelector('.job[data-i]'); if(j){j.click();return 'job';}} return null;})()")
            r = r or await pg.evaluate(SOLVE); log[r]=log.get(r,0)+1
        d = await pg.evaluate("(()=>{const d=GS.Game.day();return {st:GS.Game.state(),score:d.score,served:d.served,lost:d.lost,tasks:d.tasksDone,late:d.tasksLate,cord:Math.round(d.cord),intrOk:d.intrOk,mate:d.mate}})()")
        await pg.screenshot(path=ROOT+'/shots/8_end.png', full_page=True)
        print(d, {k:v for k,v in log.items() if k not in ('idle',None)}, errs or 'ok'); await b.close()
asyncio.run(main())
