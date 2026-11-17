<script lang="ts">
 let { text }: { text: string } = $props();
 const blocks = $derived(text.replace(/\r\n/g, '\n').split(/\n\s*\n/));
 function inline(value: string) {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).filter(Boolean);
 }
</script>

{#snippet content(value: string)}
 {#each inline(value) as token, index (index)}
  {#if token.startsWith('**') && token.endsWith('**')}<strong>{token.slice(2,-2)}</strong>
  {:else if token.startsWith('`') && token.endsWith('`')}<code>{token.slice(1,-1)}</code>
  {:else if token.startsWith('*') && token.endsWith('*')}<em>{token.slice(1,-1)}</em>
  {:else if /^\[[^\]]+\]\(https?:\/\/[^\s)]+\)$/.test(token)}
   <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
   <a href={token.slice(token.indexOf('](')+2,-1)} target="_blank" rel="noopener noreferrer">{token.slice(1,token.indexOf(']('))}</a>
  {:else}{token}{/if}
 {/each}
{/snippet}

<div class="quote-markdown">
 {#each blocks as block, index (index)}
  {@const lines=block.split('\n')}
  {#if block.startsWith('```')}<pre><code>{block.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')}</code></pre>
  {:else if lines.every(line=>/^\s*[-*+]\s+/.test(line))}<ul>{#each lines as line,i (i)}<li>{@render content(line.replace(/^\s*[-*+]\s+/,''))}</li>{/each}</ul>
  {:else if lines.every(line=>/^\s*\d+[.)]\s+/.test(line))}<ol>{#each lines as line,i (i)}<li>{@render content(line.replace(/^\s*\d+[.)]\s+/,''))}</li>{/each}</ol>
  {:else}
   {#each lines as line,i (i)}
    {#if /^#{1,6}\s/.test(line)}<svelte:element this={`h${Math.min(6,line.match(/^#+/)![0].length)}`}>{@render content(line.replace(/^#+\s/,''))}</svelte:element>
    {:else if line.trim()}<p>{@render content(line)}</p>{/if}
   {/each}
  {/if}
 {/each}
</div>

<style>
 .quote-markdown{font-size:.875rem;line-height:1.65;overflow-wrap:anywhere}.quote-markdown>:global(*+*){margin-top:.625rem}h1,h2,h3,h4,h5,h6{font-weight:600;line-height:1.4}h1,h2{font-size:1.125rem}ul,ol{padding-left:1.25rem}ul{list-style:disc}ol{list-style:decimal}li+li{margin-top:.25rem}code{padding:.1rem .25rem;border-radius:.25rem;background:var(--color-bg-app);font-size:.85em}pre{overflow:auto;padding:.75rem;border-radius:.5rem;background:var(--color-bg-app);white-space:pre-wrap}a{color:var(--color-primary);text-decoration:underline}
</style>
