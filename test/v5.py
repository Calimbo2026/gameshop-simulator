import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':1000,'height':760}, device_scale_factor=1)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/gss/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('up',{cartel:2,sillas:1,mesa:1,isla:1,gondola:1,arcade:1,escritorio:1}); GS.Store.set('testDay',6); GS.Store.set('testCond','ninguna'); GS.Store.set('seen',{mostrador:1,caja:1})")
        await pg.click('#btnPlay'); await pg.wait_for_timeout(400)
        combos=[('corto',['beard','glasses']),('largo',['lashes','lips']),('rulos',['glasses']),('rodete',['lashes']),('mohicano',['beard']),('pelado',['beard','lashes'])]
        on=set()
        for i,(st,acc) in enumerate(combos):
            await pg.click(f'#avStyle button[data-v="{st}"]')
            for a in ['glasses','beard','lips','lashes']:
                if (a in acc) != (a in on): await pg.click(f'#avAcc button[data-v="{a}"]'); on ^= {a}
            await pg.click(f'.sw[data-k="hair"] button:nth-child({i+1})'); await pg.wait_for_timeout(120)
            el = await pg.query_selector('#avPrev'); await el.screenshot(path=f'shots/av{i}.png')
        await pg.click('[data-close]')
        await pg.wait_for_function("GS.Game.pendingJobs().length>=1", timeout=120000); await pg.wait_for_timeout(2500)
        await pg.mouse.move(500,400); await pg.mouse.wheel(0,-1300); await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/v_zoom.png')
        print(errs or 'ok'); await b.close()
asyncio.run(main())
