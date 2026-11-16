import { expect,it,vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuoteAgentChat from './QuoteAgentChat.svelte';
it('sends a requested correction and preserves the message while waiting for acknowledgement', async()=>{
 const send=vi.fn().mockResolvedValue(true);
 const view=await render(QuoteAgentChat,{messages:[],active:false,onsend:send,oncancel:vi.fn()});
 await view.getByRole('textbox',{name:'Co chcesz zmienić?'}).fill('Skróć opisy');
 await view.getByRole('button',{name:'Wyślij wiadomość'}).click();
 expect(send).toHaveBeenCalledWith('Skróć opisy');
 await expect.element(view.getByRole('textbox')).toHaveValue('');
});
it('keeps a correction when sending fails',async()=>{
 const view=await render(QuoteAgentChat,{messages:[],active:false,onsend:vi.fn().mockResolvedValue(false),oncancel:vi.fn()});
 await view.getByRole('textbox').fill('Uprość zakres');
 await view.getByRole('button',{name:'Wyślij wiadomość'}).click();
 await expect.element(view.getByRole('textbox')).toHaveValue('Uprość zakres');
});
