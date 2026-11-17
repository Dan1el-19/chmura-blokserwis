<script lang="ts">
 import { untrack } from 'svelte';
 import QuoteMarkdown from './QuoteMarkdown.svelte';
 import { Collapsible } from 'bits-ui';
 import type { QuoteAgentMessage } from '#lib/gen/unisource/v2/quotes_pb.js';
 import { button, field, primary } from './ui.js';
 let { messages, active, partialText = '', onsend, oncancel }: {
  messages: Pick<QuoteAgentMessage,'id'|'role'|'text'>[]; active:boolean; partialText?:string;
  onsend:(text:string)=>Promise<boolean>; oncancel:()=>void;
 }=$props();
 let input=$state('');
 let sending=$state(false);
 let viewport=$state<HTMLDivElement>();
 let following=$state(true);
 let historyOpen=$state(false);
 const latest=$derived(messages.at(-1));
 $effect(()=>{
  const count=messages.length; const partial=partialText;
  void count; void partial;
  untrack(()=>{if(following && viewport) queueMicrotask(()=>{if(viewport) viewport.scrollTop=viewport.scrollHeight;});});
 });
 async function send(){
  const text=input.trim(); if(!text||active||sending)return;
  sending=true;
  try {if(await onsend(text)){if(input.trim()===text)input='';following=true;}}
  finally {sending=false;}
 }
</script>
<section class="agent-chat space-y-4" aria-label="Rozmowa z asystentem AI">
 <div class="flex items-center justify-between gap-3"><h2 class="font-semibold">Asystent AI</h2>{#if active}<button class={button} type="button" onclick={oncancel}>Zatrzymaj</button>{/if}</div>
 {#if messages.length}
 {#if !historyOpen && !active && latest?.role==='assistant'}
 <article class="message"><p class="mb-1 text-xs font-medium text-text-muted">Asystent</p><QuoteMarkdown text={latest.text}/></article>
 {/if}
 <Collapsible.Root bind:open={historyOpen}>
  <Collapsible.Trigger class="min-h-11 text-sm font-medium text-primary">{historyOpen?'Ukryj rozmowę':'Zobacz rozmowę'} ({messages.length})</Collapsible.Trigger>
  <Collapsible.Content>
   <div class="chat-messages space-y-3" bind:this={viewport} onscroll={()=>{if(viewport)following=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<64;}}>
    {#each messages as message (message.id)}
     <article class:user={message.role==='user'} class="message"><p class="mb-1 text-xs font-medium text-text-muted">{message.role==='user'?'Ty':'Asystent'}</p><QuoteMarkdown text={message.text}/></article>
    {/each}
   </div>
   {#if !following}<button type="button" class={button} onclick={()=>{following=true;if(viewport)viewport.scrollTop=viewport.scrollHeight;}}>Najnowsza wiadomość ↓</button>{/if}
  </Collapsible.Content>
 </Collapsible.Root>
 {/if}
 <form onsubmit={(event)=>{event.preventDefault();void send();}} class="space-y-2">
  <label class="block text-sm font-medium" for="quote-agent-input">Co chcesz zmienić?</label>
  <textarea id="quote-agent-input" class={field} rows="3" maxlength="4000" placeholder="Np. skróć opis lub doprecyzuj zakres prac" bind:value={input} disabled={sending}></textarea>
  <div class="flex flex-wrap items-center justify-between gap-2"><p class="text-xs text-text-muted">Asystent zaproponuje zmiany do sprawdzenia.</p><button class={primary} type="submit" disabled={active||sending||!input.trim()} aria-label="Wyślij wiadomość">{sending?'Wysyłanie…':'Wyślij'}</button></div>
 </form>
</section>
<style>
 .agent-chat{min-width:0;overflow-wrap:anywhere}.chat-messages{max-height:24rem;overflow:auto;overscroll-behavior:contain;padding:.25rem}
 .message{padding:.75rem;border:1px solid var(--color-border-line);border-radius:.75rem}.message.user{background:var(--color-bg-app);margin-left:1rem}
 textarea{min-height:6rem;scroll-margin-bottom:8rem}
</style>
