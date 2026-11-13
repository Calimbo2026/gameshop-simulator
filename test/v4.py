import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':1000,'height':760}, device_scale_factor=1)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/gameshop-simulator/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('up',{cartel:2,sillas:1,mesa:1,isla:1,gondola:1,arcade:1,escritorio:1}); GS.Store.set('testDay',6); GS.Store.set('testCond','lluvia'); GS.Store.set('seen',{mostrador:1,caja:1,pc:1})")
        await pg.click('#btnPlay'); await pg.wait_for_timeout(500); await pg.screenshot(path='shots/v_avatar0.png')
        await pg.click('#avStyle button[data-v="rulos"]'); await pg.click('#avAcc button[data-v="glasses"]'); await pg.click('#avAcc button[data-v="beard"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='shots/v_avatar.png'); await pg.click('[data-close]')
        await pg.wait_for_function("GS.Game.pendingJobs().length>=1", timeout=120000); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/v_day.png')
        await pg.mouse.move(500,400); await pg.mouse.wheel(0,-900); await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/v_zoom.png')
        await pg.evaluate("GS.Game.openJob(GS.Game.pendingJobs()[0])"); await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/v_most.png')
        await pg.evaluate("GS.Game.startArcade('pc')"); await pg.wait_for_timeout(2200); await pg.screenshot(path='shots/v_pc.png')
        print(errs or 'ok'); await b.close()
asyncio.run(main())
