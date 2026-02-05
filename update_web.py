#!/usr/bin/env python3
"""
記号接地待ち Web版 更新スクリプト

このスクリプトは以下を行います：
1. Amazonほしい物リストから商品情報を取得
2. 商品画像をダウンロード
3. data.json を生成
4. GitHubにプッシュ
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request

# 設定
WISHLIST_URL = "https://www.amazon.co.jp/hz/wishlist/ls/2UQ7O1570CFAX"
WEB_DIR = os.path.expanduser("~/Desktop/symbol-grounding-web")
IMAGES_DIR = os.path.join(WEB_DIR, "images")

def fetch_wishlist_html(url):
    """ほしい物リストのHTMLを取得"""
    print(f"📥 ほしい物リストを取得中: {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8')
            return html
    except Exception as e:
        print(f"❌ HTMLの取得に失敗: {e}")
        return None

def parse_wishlist(html):
    """HTMLから商品情報を抽出"""
    print("🔍 商品情報を解析中...")
    
    items = []
    
    item_pattern = re.compile(
        r'id="itemName_([^"]+)"[^>]*title="([^"]*)"[^>]*href="(/dp/([A-Z0-9]+)/[^"]*)"',
        re.DOTALL
    )
    
    img_pattern = re.compile(
        r'src="(https://m\.media-amazon\.com/images/I/[^"]+\._SS135_\.jpg)"'
    )
    
    all_images = img_pattern.findall(html)
    
    for match in item_pattern.finditer(html):
        item_id = match.group(1)
        title = match.group(2)
        href = match.group(3)
        asin = match.group(4)
        
        item_pos = match.start()
        
        img_url = None
        for img in all_images:
            img_pos = html.find(img)
            if img_pos < item_pos and img_pos > item_pos - 2000:
                img_url = img
        
        if not img_url:
            item_index = len(items)
            if item_index < len(all_images):
                img_url = all_images[item_index + 2]
        
        if img_url:
            img_url_hd = img_url.replace('._SS135_.', '._SL500_.')
            
            items.append({
                'id': asin,
                'name': title,
                'url': f'https://www.amazon.co.jp/dp/{asin}',
                'image_url': img_url_hd
            })
            
            print(f"  ✓ {title[:40]}...")
    
    print(f"📚 {len(items)} 件の商品を発見")
    return items

def download_images(items, output_dir):
    """商品画像をダウンロード"""
    print(f"\n📷 画像をダウンロード中...")
    
    os.makedirs(output_dir, exist_ok=True)
    
    downloaded = []
    
    for item in items:
        img_url = item['image_url']
        filename = f"{item['id']}.jpg"
        filepath = os.path.join(output_dir, filename)
        
        if os.path.exists(filepath):
            print(f"  ⏭ {filename} (既存)")
            downloaded.append({
                'id': item['id'],
                'image': f"images/{filename}",
                'url': item['url'],
                'name': item['name']
            })
            continue
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            }
            req = urllib.request.Request(img_url, headers=headers)
            
            with urllib.request.urlopen(req, timeout=15) as response:
                with open(filepath, 'wb') as f:
                    f.write(response.read())
            
            print(f"  ✓ {filename}")
            downloaded.append({
                'id': item['id'],
                'image': f"images/{filename}",
                'url': item['url'],
                'name': item['name']
            })
            
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  ❌ {filename}: {e}")
    
    return downloaded

def generate_data_json(items, output_path):
    """data.json を生成"""
    print(f"\n📝 data.json を生成中...")
    
    data = [
        {
            'id': item['id'],
            'image': item['image'],
            'url': item['url']
        }
        for item in items
    ]
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"  ✓ {len(data)} 件のデータを保存")

def push_to_github(web_dir):
    """GitHubにプッシュ"""
    print(f"\n🚀 GitHubにプッシュ中...")
    
    try:
        os.chdir(web_dir)
        
        # Git add
        subprocess.run(['git', 'add', '.'], check=True)
        
        # Git commit
        result = subprocess.run(
            ['git', 'commit', '-m', f'Update wishlist: {time.strftime("%Y-%m-%d %H:%M")}'],
            capture_output=True,
            text=True
        )
        
        if 'nothing to commit' in result.stdout + result.stderr:
            print("  ℹ️  変更なし")
            return True
        
        # Git push
        subprocess.run(['git', 'push'], check=True)
        
        print("  ✓ プッシュ完了")
        return True
        
    except Exception as e:
        print(f"  ❌ プッシュ失敗: {e}")
        return False

def main():
    print("=" * 50)
    print("🖼  記号接地待ち Web版 更新スクリプト")
    print("=" * 50)
    
    # 1. ほしい物リストを取得
    html = fetch_wishlist_html(WISHLIST_URL)
    if not html:
        print("❌ ほしい物リストの取得に失敗しました")
        sys.exit(1)
    
    # 2. 商品情報を解析
    items = parse_wishlist(html)
    if not items:
        print("❌ 商品情報の解析に失敗しました")
        sys.exit(1)
    
    # 3. 画像をダウンロード
    downloaded = download_images(items, IMAGES_DIR)
    
    # 4. data.json を生成
    data_json_path = os.path.join(WEB_DIR, "data.json")
    generate_data_json(downloaded, data_json_path)
    
    # 5. GitHubにプッシュ
    if push_to_github(WEB_DIR):
        print("\n" + "=" * 50)
        print("✅ 更新完了！")
        print("   https://morikazusuma.github.io/symbol-grounding/")
        print("=" * 50)
    else:
        print("\n⚠️  プッシュに失敗しましたが、ローカルは更新されました")
        print("   手動でgit pushしてください")

if __name__ == "__main__":
    main()
