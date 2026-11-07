#!/usr/bin/env python3
"""Build the two locale-specific LLM indexes from the public HTML, without deps.

Run `python3 scripts/build-discovery.py` after editing public content, or add
`--check` to verify that the committed exports are current without writing them.
Publication dates and author attribution come from the corresponding page; the
generator deliberately does not stamp an invented update or review date.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin


ROOT = Path(__file__).resolve().parents[1]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP = {"script", "style", "svg", "nav", "button", "picture", "img"}
BLOCK = {"article", "aside", "div", "figure", "figcaption", "header", "main", "section"}
LABELS = {
    "ru": {
        "language": "Язык и регион", "geography": "География", "experts": "Эксперты",
        "contacts": "Связаться", "resources": "Основные страницы и данные", "publications": "Публикации",
        "home": "Главная страница", "catalogue": "Каталог публикаций", "schema": "Структурированные данные",
        "full": "Полный текст главной и публикаций", "index": "Краткий указатель для LLM",
        "canonical": "Канонический URL", "published": "Дата публикации на genai.by", "count": "Количество публикаций",
        "description": "Краткое описание", "original": "Источник адаптации",
        "notice": "Текст главной страницы и всех публикаций на русском языке. У каждой статьи сохранены канонический URL, авторство, дата публикации на genai.by и ссылки из материала. Для цитирования используйте URL соответствующей страницы.",
    },
    "be": {
        "language": "Мова і рэгіён", "geography": "Геаграфія", "experts": "Эксперты",
        "contacts": "Звязацца", "resources": "Асноўныя старонкі і даныя", "publications": "Публікацыі",
        "home": "Галоўная старонка", "catalogue": "Каталог публікацый", "schema": "Структураваныя даныя",
        "full": "Поўны тэкст галоўнай і публікацый", "index": "Кароткі паказальнік для LLM",
        "canonical": "Кананічны URL", "published": "Дата публікацыі на genai.by", "count": "Колькасць публікацый",
        "description": "Кароткае апісанне", "original": "Крыніца адаптацыі",
        "notice": "Тэкст галоўнай старонкі і ўсіх публікацый на беларускай мове. У кожным артыкуле захаваныя кананічны URL, аўтарства, дата публікацыі на genai.by і спасылкі з матэрыялу. Для цытавання выкарыстоўвайце URL адпаведнай старонкі.",
    },
}


@dataclass
class Element:
    tag: str
    attrs: dict[str, str | None] = field(default_factory=dict)
    children: list[Element | str] = field(default_factory=list)

    def has_class(self, name: str) -> bool:
        return name in (self.attrs.get("class") or "").split()


class Document(HTMLParser):
    """Small DOM for this static site's explicit, closed HTML elements."""

    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.root = Element("document")
        self.stack = [self.root]
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Element(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Element(tag, dict(attrs)))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def walk(node):
    if isinstance(node, Element):
        yield node
        for child in node.children:
            yield from walk(child)


def find(node, *, tag=None, class_name=None, ident=None):
    return next((item for item in walk(node)
                 if (tag is None or item.tag == tag)
                 and (class_name is None or item.has_class(class_name))
                 and (ident is None or item.attrs.get("id") == ident)), None)


def require(node, context, **selector):
    result = find(node, **selector)
    if result is None:
        raise ValueError(f"{context}: missing {selector}")
    return result


def raw_text(node):
    return node if isinstance(node, str) else "".join(raw_text(child) for child in node.children)


def plain(node):
    return re.sub(r"\s+", " ", raw_text(node)).strip()


def clean(markdown):
    # Normalize spacing between HTML blocks without changing executable examples.
    code_blocks = []

    def protect(match):
        code_blocks.append(match[0])
        return f"\x00CODE_BLOCK_{len(code_blocks) - 1}\x00"

    markdown = re.sub(r"(?m)^(`{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$", protect, markdown)
    markdown = re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+\n", "\n", markdown)).strip()
    for index, block in enumerate(code_blocks):
        markdown = markdown.replace(f"\x00CODE_BLOCK_{index}\x00", block)
    return markdown


def sentence(value):
    return value if re.search(r"[.!?…]$", value) else value + "."


def canonical(document):
    link = next((node for node in walk(document)
                 if node.tag == "link" and node.attrs.get("rel") == "canonical"), None)
    if link is None or not (link.attrs.get("href") or "").startswith("https://genai.by/"):
        raise ValueError("Missing canonical genai.by URL")
    return link.attrs["href"]


def link(label, href, base):
    # URLs remain absolute even when extracted from a relative author/source link.
    target = urljoin(base, href).replace(" ", "%20").replace("(", "%28").replace(")", "%29")
    label = label.strip().rstrip(" ↗→↓").replace("[", "\\[").replace("]", "\\]")
    return f"[{label}]({target})"


class Markdown:
    def __init__(self, base, heading_shift=1):
        self.base = base
        self.heading_shift = heading_shift

    def children(self, node):
        return "".join(self.render(child) for child in node.children)

    def inline(self, node):
        return re.sub(r"\s+", " ", self.children(node)).strip()

    def render(self, node):
        if isinstance(node, str):
            return re.sub(r"\s+", " ", node)
        if node.tag in SKIP or "hidden" in node.attrs or node.attrs.get("aria-hidden") == "true":
            return ""
        if node.tag == "pre":
            code = raw_text(node).strip("\n")
            child = find(node, tag="code")
            language = re.search(r"(?:^|\s)language-([\w+-]+)", (child.attrs.get("class") or "") if child else "")
            fence = "`" * max(3, max((len(run) + 1 for run in re.findall(r"`+", code)), default=3))
            return f"\n\n{fence}{language[1] if language else ''}\n{code}\n{fence}\n\n"
        if node.tag == "table":
            return self.table(node)
        if node.tag in {"ol", "ul"}:
            rows = []
            start = int(node.attrs.get("start") or "1")
            for index, item in enumerate(child for child in node.children if isinstance(child, Element) and child.tag == "li"):
                prefix = f"{start + index}. " if node.tag == "ol" else "- "
                lines = clean(self.children(item)).splitlines()
                if lines:
                    rows.append(prefix + lines[0] + "".join("\n" + " " * len(prefix) + line for line in lines[1:]))
            return "\n\n" + "\n".join(rows) + "\n\n"
        if node.tag == "blockquote":
            return "\n\n" + "\n".join("> " + line for line in clean(self.children(node)).splitlines()) + "\n\n"
        if node.tag == "a":
            if node.has_class("contact-button"):
                label = " — ".join(plain(item) for item in node.children if isinstance(item, Element))
                small, strong = find(node, tag="small"), find(node, tag="strong")
                if small and strong:
                    label = plain(small) + " — " + plain(strong)
            else:
                label = self.inline(node)
            return link(label, node.attrs["href"], self.base) if node.attrs.get("href") else label
        if re.fullmatch(r"h[1-6]", node.tag):
            level = min(6, int(node.tag[1]) + self.heading_shift)
            return "\n\n" + "#" * level + " " + self.inline(node) + "\n\n"
        if node.tag in {"strong", "b", "em", "i", "code"}:
            value = self.inline(node)
            if not value:
                return ""
            marker = "**" if node.tag in {"strong", "b"} else "*"
            if node.tag == "code":
                marker = "`" * max(1, max((len(run) + 1 for run in re.findall(r"`+", value)), default=1))
            return marker + value + marker
        if node.tag == "summary":
            return "\n\n**" + self.inline(node) + "**\n\n"
        if node.tag == "br":
            return " "
        if node.tag == "hr":
            return "\n\n---\n\n"
        if node.tag == "p" or node.has_class("mono-label") or node.has_class("hero-kicker"):
            return "\n\n" + self.inline(node) + "\n\n"
        body = self.children(node)
        return "\n\n" + clean(body) + "\n\n" if node.tag in BLOCK else body

    def table(self, node):
        rows = []
        for row in walk(node):
            if row.tag == "tr":
                cells = [self.inline(cell).replace("|", "\\|") for cell in row.children
                         if isinstance(cell, Element) and cell.tag in {"td", "th"}]
                if cells:
                    rows.append(cells)
        if not rows:
            return ""
        width = max(map(len, rows))
        rows = [row + [""] * (width - len(row)) for row in rows]
        lines = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join(["---"] * width) + " |"]
        lines.extend("| " + " | ".join(row) + " |" for row in rows[1:])
        caption = find(node, tag="caption")
        return "\n\n" + (self.inline(caption) + "\n\n" if caption else "") + "\n".join(lines) + "\n\n"


def load_page(path):
    return Document(path.read_text(encoding="utf-8")).root


def build(locale):
    labels = LABELS[locale]
    directory = ROOT / ("be" if locale == "be" else "")
    home = load_page(directory / "index.html")
    home_url = canonical(home)
    render = Markdown(home_url)
    language = require(home, "home", tag="html").attrs["lang"]
    geography = require(home, "home", ident="geography")
    hero = require(home, "home", class_name="hero-lead")
    kicker = require(home, "home", class_name="hero-kicker")
    pages = json.loads((directory / "publications/manifest.json").read_text(encoding="utf-8"))
    page_slugs = [item["slug"] for item in pages]
    actual_slugs = {path.parent.name for path in (directory / "publications").glob("*/index.html")}
    if len(set(page_slugs)) != len(page_slugs) or set(page_slugs) != actual_slugs:
        raise ValueError(f"{locale}: publication manifest and HTML paths disagree")

    common = [
        f"{labels['canonical']}: {home_url}", f"{labels['language']}: {language}.", "",
        "[Русская версия](https://genai.by/) · [Беларуская версія](https://genai.by/be/)",
        "", f"## {labels['geography']}", "", plain(geography), "",
    ]
    resources = [
        f"## {labels['resources']}", "",
        f"- [{labels['home']}]({home_url})",
        f"- [{labels['catalogue']}]({home_url}publications/)",
        f"- [{labels['schema']}]({home_url}ai.json)",
        f"- [{labels['index']}]({home_url}llms.txt)",
        f"- [{labels['full']}]({home_url}llms-full.txt)",
        "- [Sitemap](https://genai.by/sitemap.xml)",
        "- [Robots](https://genai.by/robots.txt)", "",
    ]
    compact = ["# CAIO / Practice", "", f"> {plain(kicker)}. {plain(hero)}", "", *common,
               f"## {labels['experts']}", ""]
    for card in (node for node in walk(home) if node.has_class("expert-card")):
        name = plain(require(card, "expert", tag="h4"))
        identity = require(card, name, class_name="expert-identity")
        roles = [plain(node) for node in walk(identity) if node.tag == "p"]
        body = require(card, name, class_name="expert-body")
        description = " ".join(sentence(plain(node)) for node in walk(body) if node.tag == "p")
        links = require(card, name, class_name="expert-links")
        related = " · ".join(render.render(node) for node in walk(links) if node.tag == "a")
        compact.extend([f"### {link(name, '#' + card.attrs['id'], home_url)}", "",
                        " ".join(sentence(role) for role in roles) + " " + description, "", related, ""])
    compact.extend([f"## {labels['contacts']}", ""])
    for contact in (node for node in walk(home) if node.has_class("contact-button")):
        compact.append("- " + render.render(contact))
    compact.extend(["", *resources, f"## {labels['publications']}", "", f"{labels['count']}: {len(pages)}.", ""])

    full = [f"# CAIO / Practice — {labels['full']}", "", labels["notice"], "", *common, *resources,
            f"## {labels['home']}", "", f"{labels['canonical']}: {home_url}", "",
            clean(Markdown(home_url, heading_shift=2).render(require(home, "home", tag="main"))), ""]
    for item in pages:
        page = load_page(directory / "publications" / item["slug"] / "index.html")
        url = canonical(page)
        if url != home_url + "publications/" + item["slug"] + "/":
            raise ValueError(f"{item['slug']}: unexpected canonical {url}")
        title = plain(require(page, url, tag="h1"))
        published = require(page, url, tag="time").attrs["datetime"]
        if title != item["title"] or published != item["published"]:
            raise ValueError(f"{url}: title or publication date disagrees with manifest")
        byline = require(page, url, class_name="article-author")
        authors = "; ".join(link(plain(author), author.attrs["href"], url)
                            for author in walk(byline) if author.tag == "a" and author.attrs.get("href"))
        if not authors:
            raise ValueError(f"{url}: missing visible authors")
        author_label = byline.attrs.get("aria-label") or ("Аўтар" if locale == "be" else "Автор")
        description = item["description"]
        compact.extend([f"- {link(title, url, home_url)} — {sentence(description)}",
                        f"  {author_label}: {authors}. {labels['published']}: {published[:10]}."])
        if item.get("source_url"):
            compact.append(f"  {labels['original']}: {item['source_url']}")
        compact.append("")
        article_hero = require(page, url, class_name="article-hero-copy")
        lead = plain(require(article_hero, url, tag="p"))
        body = require(page, url, class_name="article-body")
        full.extend(["---", "", f"## {title}", "", f"{labels['canonical']}: {url}",
                     f"{author_label}: {authors}", f"{labels['published']}: {published[:10]}", "",
                     lead, "", clean(Markdown(url).render(body)), ""])
    outputs = {directory / "llms.txt": clean("\n".join(compact)) + "\n",
               directory / "llms-full.txt": clean("\n".join(full)) + "\n"}
    for path, output in outputs.items():
        if "vadimohka.com" in output or "t.me/vadimohka" in output:
            raise ValueError(f"{path.relative_to(ROOT)}: outdated Vadim contact in source HTML")
        if "https://vadimohka.ru/" not in output:
            raise ValueError(f"{path.relative_to(ROOT)}: missing Vadim website in source HTML")
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if committed exports are stale; do not write")
    args = parser.parse_args()
    outputs = {**build("ru"), **build("be")}
    stale = []
    for path, output in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != output:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(output, encoding="utf-8")
            print(f"Built {path.relative_to(ROOT)} ({len(output.encode('utf-8')):,} bytes)")
    if stale:
        print("Stale discovery exports: " + ", ".join(stale), file=sys.stderr)
        print("Run: python3 scripts/build-discovery.py", file=sys.stderr)
        return 1
    if args.check:
        print("Discovery exports are current (2 locales, complete publication coverage).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, KeyError) as error:
        print(f"Discovery export failed: {error}", file=sys.stderr)
        sys.exit(1)
