import sys, asyncio
from playwright.async_api import async_playwright
SOLVE_M = "(()=>{const c=GS.Game.day().customers.find(c=>c.st==='inM');document.querySelector('.opt[data-id=\"'+c.product.id+'\"]').click()})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        errs=[]
        w,h,mob = (844,390,True) if sys.argv[1]=='l' else (1100,700,False) if sys.argv[1]=='d' else (390,844,True)
        ctx = await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, has_touch=mob, is_mobile=mob)
        pg = await ctx.new_page(); n=sys.argv[1]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        await pg.goto('file:///home/claude/gss/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'shots/{n}_start.png')
        await pg.click('#phasesStart'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'shots/{n}_phases.png'); await pg.click('[data-close]')
        await pg.click('#btnRelax'); await pg.wait_for_timeout(400); await pg.click('[data-close]')
        for i,var in enumerate(['vuelto','comprobante','cobro']):
            await pg.evaluate(f"GS.DEBUG_VARIANT='{var}'")
            await pg.wait_for_function("GS.Game.day().customers.some(c=>c.st==='waitM')", timeout=90000)
            await pg.click('#stM'); await pg.wait_for_timeout(900)
            if i==0:
                # un error a propósito
                await pg.evaluate("(()=>{const c=GS.Game.day().customers.find(c=>c.st==='inM');[...document.querySelectorAll('.opt')].find(o=>o.dataset.id!==c.product.id).click()})()")
                await pg.wait_for_timeout(500); await pg.screenshot(path=f'shots/{n}_most_err.png')
            await pg.evaluate(SOLVE_M)
            await pg.wait_for_function("GS.Game.day().customers.some(c=>c.st==='waitC')", timeout=90000)
            await pg.click('#stC'); await pg.wait_for_timeout(1000)
            await pg.screenshot(path=f'shots/{n}_caja_{var}.png')
            if var=='vuelto':
                # resolver: leer total y pago
                await pg.evaluate("""(()=>{const bs=[...document.querySelectorAll('.info b')].map(b=>parseInt(b.textContent.replace(/\\D/g,'')));let ch=bs[1]-bs[0];
                  const bills=[20000,10000,2000,1000];const btn=[...document.querySelectorAll('.bill')];
                  bills.forEach((v,i)=>{while(ch>=v){btn[i].click();ch-=v}});document.getElementById('mgGive').click()})()""")
            elif var=='comprobante':
                fake = await pg.evaluate("(()=>{const r=document.getElementById('mgRec').textContent;return !(r.includes('ParaGameShopM')&&r.includes('Hoy,')&&r.includes('Aprobada'))})()")
                box = await pg.eval_on_selector('#mgRec','e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}')
                await pg.mouse.move(box[0],box[1]); await pg.mouse.down(); await pg.mouse.move(box[0]+(-120 if fake else 120),box[1],steps=6); await pg.screenshot(path=f'shots/{n}_swipe.png'); await pg.mouse.up()
            else:
                await pg.keyboard.press('1')
                await pg.wait_for_timeout(400); await pg.screenshot(path=f'shots/{n}_cobro_after1.png')
                for k in ['2','3']:
                    if await pg.evaluate("GS.Minigames.isOpen() && !GS.Minigames.isResolving()"): await pg.keyboard.press(k); await pg.wait_for_timeout(300)
            await pg.wait_for_timeout(1800)
            print(var, await pg.evaluate("JSON.stringify({s:GS.Game.day().score,sales:GS.Game.day().sales,served:GS.Game.day().served,err:GS.Game.day().cajaErr,open:GS.Minigames.isOpen()})"))
        await pg.screenshot(path=f'shots/{n}_mid.png')
        await pg.click('#btnPause'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'shots/{n}_pause.png'); await pg.click('#pResume')
        await pg.evaluate("GS.Game.endDay()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'shots/{n}_end.png', full_page=False)
        print('\n'.join(errs) or 'sin errores'); await b.close()
asyncio.run(main())
