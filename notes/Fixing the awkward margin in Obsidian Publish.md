The default Obsidian publish theme, has a weird margin for root docs (docs not in subfolders) on the sidebar. 

![[CleanShot 2025-10-20 at 09.51.57@2x.png|500]]

You see it? There's an extra left margin at `hey 👋`.

To fix this, simply copy paste the CSS below into `publish.css` in your Obsidian root directory. 

```css
div.tree-item-children > div > div:not(.mod-collapsible).is-clickable .tree-item-inner {
	margin-left: -3px;
}
```

It should fix the CSS for all root docs!

Reference:
https://help.obsidian.md/publish/customize