import sys, asyncio
from playwright.async_api import async_playwright
SOLVE = r"""(()=>{const M=GS.Minigames; if(!M.isOpen()||M.isResolving()) return 'idle';
 const q=s=>document.querySelector('#mg '+s), qa=s=>[...document.querySelectorAll('#mg '+s)];
 if(q('.part')){const now=q('.slot.now'); if(!now) return 'pc?'; const name=now.textContent.replace(/^\d/,''); const b=qa('.part').find(p=>p.querySelector('.n').textContent===name); b.click(); return 'pc';}
 if(q('.dust')){const d=qa('.dust:not(.gone)'); d.slice(0,4).forEach(e=>{const r=e.getBoundingClientRect(); q('.fan').dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true}))}); return 'pelusa';}
 if(q('#mgSnap')){const m=parseFloat(q('#mgMark').style.left||0), z=q('.zone'); const a=parseFloat(z.style.left), w=parseFloat(z.style.width); if(m>=a+2&&m<=a+w-2){q('#mgSnap').click();return 'ram!';} return 'ram';}
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
        shots={'pc':1,'service':3,'ml':2,'whatsapp':1,'repo':1}
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
            if n>=3 and not got: got=True; await pg.screenshot(path='shots/2_day.png')
            if n>0 and i%12==0: await pg.evaluate("GS.Game.openJob(GS.Game.pendingJobs()[0])")
            await pg.evaluate(SOLVE)
        if not got: await pg.screenshot(path='shots/2_day.png')
        await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/2_end.png')
        print(await pg.evaluate("JSON.stringify((d=>({score:d.score,served:d.served,tasks:d.tasksDone,lost:d.lost,late:d.tasksLate,err:d.cajaErr+d.otherErr}))(GS.Game.day()))"))
        print('\n'.join(errs) or 'sin errores'); await b.close()
asyncio.run(main())
