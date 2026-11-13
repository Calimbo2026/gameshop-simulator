import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/gameshop-simulator/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/s_start.png')
        await pg.click('#btnPlay'); await pg.wait_for_timeout(400); await pg.screenshot(path='shots/s_avatar.png')
        await pg.click('.sw[data-k="hair"] button:nth-child(6)'); await pg.click('[data-close]')
        await pg.wait_for_function("!!document.querySelector('.say.boss')", timeout=60000); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots/s_day1.png')
        await pg.evaluate("GS.Store.set('coins',1000)"); await pg.click('#btnPause'); await pg.click('#pExit'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/s_start2.png')
        await pg.click('#btnShop'); await pg.wait_for_timeout(1800); await pg.screenshot(path='shots/s_shop1.png')
        await pg.click('[data-buy="0"]'); await pg.wait_for_timeout(600)
        await pg.click('.slotb[data-i="0"]'); await pg.wait_for_timeout(1800); await pg.screenshot(path='shots/s_shop2.png')
        await pg.evaluate("document.getElementById('shopCards').scrollLeft=400"); await pg.wait_for_timeout(900); await pg.screenshot(path='shots/s_shop3.png')
        await pg.click('#shopDone'); await pg.wait_for_timeout(500)
        print(await pg.evaluate("JSON.stringify([GS.Store.get('coins'),GS.Store.get('up')])"), errs or 'ok'); await b.close()
asyncio.run(main())
