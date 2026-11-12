import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        for name,w,h in (('p',390,844),('l',844,390)):
            ctx = await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1.5, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
            await pg.goto('file:///home/claude/gss/dist/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('#btnPlay'); await pg.wait_for_timeout(400); await pg.click('[data-close]')
            await pg.wait_for_function("GS.Game.pendingJobs().length>=3", timeout=240000)
            await pg.wait_for_timeout(500); await pg.screenshot(path=f'shots/3_{name}_day.png')
            await pg.click('.job[data-i="0"]'); await pg.wait_for_timeout(1200); await pg.screenshot(path=f'shots/3_{name}_job.png')
            if name=='p':
                await pg.evaluate("GS.Game.startArcade('pc')"); await pg.wait_for_timeout(2500); await pg.screenshot(path='shots/3_p_arc.png')
            print(name, errs or 'ok'); await ctx.close()
        await b.close()
asyncio.run(main())
