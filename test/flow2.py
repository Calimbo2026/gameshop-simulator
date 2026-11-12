import sys, asyncio
from playwright.async_api import async_playwright
SOLVE = r"""(()=>{const M=GS.Minigames; if(!M.isOpen()||M.isResolving()) return 'idle';
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
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        errs=[]
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        await pg.goto('file:///home/claude/gss/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/2_start.png')
        await pg.click('#btnArcade'); await pg.wait_for_timeout(300); await pg.screenshot(path='shots/2_arcade.png'); await pg.click('[data-close]')
        shots={'mostrador':1,'stock':1,'proveedor':1,'devol':1,'cierre':1,'repo':1}
        for st,n in shots.items():
            await pg.evaluate(f"GS.Game.startArcade('{st}')")
            taken=0; seen=set()
            for i in range(400):
                await pg.wait_for_timeout(120)
                if await pg.evaluate("GS.Game.state()")=='end': break
                head = await pg.evaluate("(document.querySelector('#mg .mg-station')||{}).textContent||''")
                if head and head not in seen and taken<n and await pg.evaluate("GS.Minigames.isOpen()&&!GS.Minigames.isResolving()"):
                    seen.add(head); await pg.wait_for_timeout(350); await pg.screenshot(path=f'shots/2_{st}_{taken}.png'); taken+=1
                await pg.evaluate(SOLVE)
            print(st, await pg.evaluate("GS.Game.state()"), await pg.evaluate("GS.Game.day().score"))
        await pg.screenshot(path='shots/2_arcend.png')
        await pg.click('#endHome'); await pg.wait_for_timeout(300)
        await pg.click('#btnPlay'); await pg.wait_for_timeout(400); await pg.click('[data-close]')
        got=False
        for i in range(2500):
            await pg.wait_for_timeout(150)
            if await pg.evaluate("GS.Game.state()")=='end': break
            n = await pg.evaluate("GS.Minigames.isOpen()?-1:GS.Game.pendingJobs().length")
            if n>=2 and not got: got=True; await pg.screenshot(path='shots/2_day.png')
            if await pg.evaluate("document.querySelectorAll('.say').length>0 && !GS.Minigames.isOpen()") and not globals().get('S1'): globals()['S1']=1; await pg.screenshot(path='shots/2_say.png')
            if await pg.evaluate("GS.Game.day().extras.length>0 && GS.Game.day().tasks.some(t=>t.boxes)") and not globals().get('S3'): globals()['S3']=1; await pg.screenshot(path='shots/2_cart.png')
            if await pg.evaluate("GS.Game.day().stage==='rest' && GS.Game.day().wave>=0 && document.querySelector('.toast.dueno')!=null") and not globals().get('S2'): globals()['S2']=1; await pg.screenshot(path='shots/2_rest.png')
            if n>0 and i%12==0: await pg.evaluate("GS.Game.openJob(GS.Game.pendingJobs()[0])")
            await pg.evaluate(SOLVE)
        if not got: await pg.screenshot(path='shots/2_day.png')
        await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/2_end.png')
        print(await pg.evaluate("JSON.stringify((d=>({score:d.score,served:d.served,tasks:d.tasksDone,lost:d.lost,late:d.tasksLate,err:d.cajaErr+d.otherErr}))(GS.Game.day()))"))
        print('\n'.join(errs) or 'sin errores'); await b.close()
asyncio.run(main())
