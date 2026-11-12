import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/gss/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('#btnRelax'); await pg.wait_for_timeout(400); await pg.click('[data-close]')
        await pg.evaluate("GS.Game.debugTask('proveedor')")
        await pg.wait_for_function("GS.Game.day().extras[0].group.position.z < 2", timeout=120000)
        await pg.screenshot(path='shots/cart1.png')
        await pg.wait_for_function("GS.Game.day().tasks.some(t=>t.boxes)", timeout=120000)
        await pg.wait_for_timeout(600); await pg.screenshot(path='shots/cart2.png')
        print(errs or 'ok'); await b.close()
asyncio.run(main())
