"""Generate a readable, data-driven GitHub Pages portfolio."""
import hashlib
import json
import re
from html import escape
from pathlib import Path
from urllib.parse import urlparse
from site_common import render_shell, revision
ROOT = Path(__file__).resolve().parent.parent

def e(value):
    return escape(str(value), quote=True)

def link(item, primary=False):
    if urlparse(item['url']).scheme != 'https':
        raise ValueError('External links must use HTTPS')
    return f'<a class="button {"primary" if primary else "secondary"}" href="{e(item["url"])}" target="_blank" rel="noopener noreferrer">{e(item["label"])} <span aria-hidden="true">↗</span></a>'

def main():
    data = json.loads((ROOT/'data/games.json').read_text(encoding='utf-8-sig'))
    games = {g['id']:g for g in data['games']}
    if len(games) != len(data['games']):
        raise ValueError('Duplicate game ID')
    featured = games[data['featured']]
    ordered = [featured, *[g for g in games.values() if g['id'] != data['featured'] and not g.get('archive')]]
    scenes, details, milestones = [], [], []
    for g in games.values():
        if not re.fullmatch(r'[a-z0-9-]+', g['id']):
            raise ValueError('Use lowercase slug IDs')
        for path in [g.get('image'),g.get('heroImage'),g.get('logo'),*[s['image'] for s in g.get('gallery',[])]]:
            if path and not (ROOT/path).is_file():
                raise ValueError(f'Missing image: {path}')
        photo = f'<img class="detail-cover" src="{e(g["image"])}" alt="{e(g.get("imageAlt",g["title"]))}" loading="lazy">' if g.get('image') else f'<div class="unreleased-art"><span>{"GAME JAM ARCHIVE" if g.get("archive") else "IN DEVELOPMENT"}</span><strong>{e(g["title"])}</strong></div>'
        shots = ''.join(f'<figure><a href="{e(s["image"])}" target="_blank" rel="noopener noreferrer"><img src="{e(s["image"])}" alt="{e(s["alt"])}" loading="lazy"></a><figcaption>{e(s["alt"])}</figcaption></figure>' for s in g.get('gallery',[]))
        achievements = ''.join(f'<li>{e(m["event"])}<strong>{e(m["result"])}</strong><small>{e(m.get("note",""))}</small></li>' for m in data['milestones'] if m['game']==g['id'])
        video = ''
        if g.get('video'):
            vid = g['video']['youtubeId']
            if not re.fullmatch(r'[A-Za-z0-9_-]{11}',vid):
                raise ValueError('Invalid YouTube ID')
            video = f'<div class="film"><p class="eyebrow">OFFICIAL OPENING FILM</p><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/{vid}" title="{e(g["title"])} 공식 오프닝" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a href="https://www.youtube.com/watch?v={vid}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a></div>'
        details.append(f'<article class="game-detail" id="room-{e(g["id"])}" data-game="{e(g["id"])}"><div class="detail-intro"><p class="eyebrow">{e(g["platform"])}</p><h2>{e(g["title"])}</h2><span class="detail-status">{e(g["status"])}</span><p class="detail-description">{e(g["description"])}</p><div class="actions">{"".join(link(l,i==0) for i,l in enumerate(g["links"]))}</div>{"<h3>참여 기록</h3><ul class=\"detail-achievements\">"+achievements+"</ul>" if achievements else ""}<a class="back-link" href="#games">← 작품 목록으로</a></div><div class="detail-media">{photo}{video}<div class="detail-gallery">{shots}</div></div></article>')
    for i,g in enumerate(ordered):
        fallback = f'<img src="{e(g["image"])}" alt="{e(g.get("imageAlt",g["title"]))}" loading="lazy">' if g.get('image') else f'<div class="unreleased-art"><strong>{e(g["title"])}</strong><small>다음 이야기를 준비하고 있습니다.</small></div>'
        scenes.append(f'<article class="game-card" id="{e(g["id"])}" aria-labelledby="title-{e(g["id"])}"><a class="game-art {e(g.get("artStyle",""))}-art" href="#room-{e(g["id"])}" aria-label="{e(g["title"])} 게임 상세 보기">{fallback}<span class="game-status {e(g.get("statusTone",""))}">{e(g["status"])}</span><span class="art-visit" aria-hidden="true">↗</span></a><div class="game-title"><h3 id="title-{e(g["id"])}"><a href="#room-{e(g["id"])}">{e(g["title"])}</a></h3><span>{i+1:02d} / {len(ordered):02d}</span></div><p class="platform">{e(g["platform"])}</p><p class="game-description">{e(g["description"])}</p><div class="game-links">{"".join(link(l,j==0) for j,l in enumerate(g["links"]))}<a class="detail-link" href="#room-{e(g["id"])}">더 알아보기</a></div></article>')
    for i,m in enumerate(data['milestones']):
        g=games[m['game']]
        milestones.append(f'<article class="milestone"><span>{i+1:02d}</span><div><h3>{e(m["event"])}</h3><a href="#room-{e(g["id"])}">{e(g["title"])}</a></div><div class="milestone-result"><strong>{e(m["result"])}</strong><small>{e(m.get("note",""))}</small></div><span>{e(m.get("year",""))}</span></article>')
    world_data=json.dumps({'featured':data['featured'],'games':[{k:g.get(k) for k in ['id','title','image','heroImage','logo','gallery']} for g in ordered]},ensure_ascii=False).replace('<','\\u003c')
    replacements = {
        'GAME_COUNT':f'{len(ordered):02d}', 'FEATURED_ID':e(featured['id']),
        'FEATURED_TITLE':e(featured.get('displayTitle',featured['title'])),
        'FEATURED_SUBTITLE':e(featured.get('subtitle','')),
        'FEATURED_LINKS':''.join(link(l,i==0) for i,l in enumerate(featured['links'])),
        'PROJECT_SCENES':''.join(scenes), 'DETAILS':''.join(details),
        'MILESTONES':''.join(milestones), 'WORLD_DATA':world_data
    }
    featured_milestone = next((m for m in data['milestones'] if m['game']==featured['id']),None)
    film = featured.get('video',{})
    replacements['FEATURED_LOGO'] = e(featured.get('logo',featured.get('image','Profile.png')))
    home = featured.get('home', {})
    replacements['FEATURED_DEMO'] = e(featured['links'][home.get('spotlightLink',0)]['url'])
    replacements['FEATURED_STAMP'] = '<br>'.join(e(line) for line in home.get('spotlightLines',[featured['status']]))
    replacements['FEATURED_PLATFORM'] = e(featured['platform'])
    replacements['FEATURED_PITCH'] = e(home.get('pitch',featured.get('tagline',featured['title'])))
    replacements['FEATURED_SUMMARY'] = e(home.get('summary',featured['description']))
    replacements.update({'FEATURED_IMAGE':e(featured.get('heroImage',featured.get('image','Profile.png'))),'FEATURED_TAGS':e(' / '.join(featured.get('tags',[featured['platform']]))),'FEATURED_MILESTONE':e(' · '.join(str(v) for v in [featured_milestone['event'],featured_milestone.get('year'),featured_milestone['result']] if v)) if featured_milestone else '', 'FEATURED_FILM':link({'url':'https://www.youtube.com/watch?v='+film['youtubeId'],'label':film.get('label','공식 영상')}) if film else ''})
    replacements['ASSET_REV'] = revision()
    output=(ROOT/'templates/home.html').read_text(encoding='utf-8-sig')
    output=render_shell(output,'home')
    for key,value in replacements.items():
        output=output.replace('{{'+key+'}}',value)
    if re.search(r'\{\{[A-Z_]+\}\}',output):
        raise ValueError('Unresolved template token')
    (ROOT/'index.html').write_text(output,encoding='utf-8')
    print(f'Built {len(ordered)} game cards, {len(games)} details, {len(milestones)} records')
if __name__=='__main__':
    main()
