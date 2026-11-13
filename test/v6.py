import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':1000,'height':760}, device_scale_factor=1)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/gameshop-simulator/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('up',{cartel:2,sillas:1,mesa:1,isla:1,gondola:1,arcade:1,escritorio:1}); GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'largo',beard:true})")
        await pg.click('#btnOpts'); await pg.click('#optAv'); await pg.wait_for_timeout(300)
        for i,st in enumerate(['corto','largo','rulos']):
            await pg.click(f'#avStyle button[data-v="{st}"]'); await pg.wait_for_timeout(100); el=await pg.query_selector('#avPrev'); await el.screenshot(path=f'shots/aw{i}.png')
        await pg.click('[data-close]'); await pg.click('[data-close]')
        await pg.evaluate("GS.Game.startArcade('repo')"); await pg.wait_for_timeout(3500); await pg.screenshot(path='shots/w_repo.png')
        await pg.click('.zone-b'); await pg.wait_for_timeout(300)
        await pg.evaluate("GS.Game.startArcade('vidriera')"); await pg.wait_for_timeout(2500); await pg.screenshot(path='shots/w_vid.png')
        for i in range(4): await pg.click(f'#mg .opt[data-i="{i}"]')
        await pg.wait_for_timeout(1900); print(await pg.evaluate("GS.Game.day().score"), errs or 'ok'); await b.close()
asyncio.run(main())
