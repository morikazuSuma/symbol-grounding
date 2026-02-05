#!/usr/bin/env python3
"""
記号接地待ち Web版 更新スクリプト（Selenium版）

Seleniumを使ってほしい物リストを全件スクロールして取得します。
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# 設定
WISHLIST_URL = "https://www.amazon.co.jp/hz/wishlist/ls/2UQ7O1570CFAX"
WEB_DIR = os.path.expanduser("~/Desktop/symbol-grounding-web")
IMAGES_DIR = os.path.join(WEB_DIR, "images")

def setup_driver():
    """Chromeドライバーをセットアップ"""
    print("🌐 ブラウザを起動中...")
    
    options = Options()
    options.add_argument('--headless')  # ヘッドレスモード
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    return driver

def scroll_and_load_all(driver):
    """ページを最後までスクロールして全件読み込む"""
    print("📜 スクロールして全件読み込み中...")
    
    last_height = driver.execute_script("return document.body.scrollHeight")
    scroll_count = 0
    
    while True:
        # ページ下部にスクロール
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        scroll_count += 1
        print(f"  スクロール {scroll_count}回目...")
        
        # 読み込み待ち
        time.sleep(2)
        
        # 新しい高さを取得
        new_height = driver.execute_script("return document.body.scrollHeight")
        
        # 高さが変わらなければ終了
        if new_height == last_height:
            # もう一度試す
            time.sleep(2)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
        
        last_height = new_height
    
    print(f"  ✓ スクロール完了（{scroll_count}回）")

def parse_wishlist(driver):
    """ページから商品情報を抽出"""
    print("🔍 商品情報を解析中...")
    
    items = []
    
    # 商品要素を取得
    try:
        item_elements = driver.find_elements(By.CSS_SELECTOR, '[id^="itemName_"]')
        
        for element in item_elements:
            try:
                # ASIN/IDを取得
                item_id = element.get_attribute('id').replace('itemName_', '')
                
                # タイトルを取得
                title = element.get_attribute('title') or element.text
                
                # リンクからASINを取得
                href = element.get_attribute('href')
                asin_match = re.search(r'/dp/([A-Z0-9]+)', href)
                if asin_match:
                    asin = asin_match.group(1)
                else:
                    continue
                
                # 画像URLを探す（親要素を遡って探す）
                parent = element.find_element(By.XPATH, './ancestor::li[contains(@class, "g-item")]')
                img_element = parent.find_element(By.CSS_SELECTOR, 'img[src*="media-amazon.com"]')
                img_url = img_element.get_attribute('src')
                
                # 高解像度版に変換
                if img_url:
                    img_url_hd = re.sub(r'\._[^.]+_\.', '._SL500_.', img_url)
                    
                    items.append({
                        'id': asin,
                        'name': title,
                        'url': f'https://www.amazon.co.jp/dp/{asin}',
                        'image_url': img_url_hd
                    })
                    
                    print(f"  ✓ {title[:40]}...")
                    
            except Exception as e:
                continue
                
    except Exception as e:
        print(f"  ⚠️ 解析エラー: {e}")
    
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
            
            time.sleep(0.3)
            
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
        
        subprocess.run(['git', 'add', '.'], check=True)
        
        result = subprocess.run(
            ['git', 'commit', '-m', f'Update wishlist: {time.strftime("%Y-%m-%d %H:%M")}'],
            capture_output=True,
            text=True
        )
        
        if 'nothing to commit' in result.stdout + result.stderr:
            print("  ℹ️  変更なし")
            return True
        
        subprocess.run(['git', 'push'], check=True)
        
        print("  ✓ プッシュ完了")
        return True
        
    except Exception as e:
        print(f"  ❌ プッシュ失敗: {e}")
        return False

def main():
    print("=" * 50)
    print("🖼  記号接地待ち Web版 更新スクリプト（Selenium版）")
    print("=" * 50)
    
    driver = None
    
    try:
        # 1. ブラウザを起動
        driver = setup_driver()
        
        # 2. ほしい物リストにアクセス
        print(f"\n📥 ほしい物リストにアクセス中...")
        driver.get(WISHLIST_URL)
        time.sleep(3)
        
        # 3. 全件読み込むまでスクロール
        scroll_and_load_all(driver)
        
        # 4. 商品情報を解析
        items = parse_wishlist(driver)
        
        if not items:
            print("❌ 商品情報の取得に失敗しました")
            sys.exit(1)
        
        # 5. 画像をダウンロード
        downloaded = download_images(items, IMAGES_DIR)
        
        # 6. data.json を生成
        data_json_path = os.path.join(WEB_DIR, "data.json")
        generate_data_json(downloaded, data_json_path)
        
        # 7. GitHubにプッシュ
        if push_to_github(WEB_DIR):
            print("\n" + "=" * 50)
            print("✅ 更新完了！")
            print("   https://morikazusuma.github.io/symbol-grounding/")
            print("=" * 50)
        else:
            print("\n⚠️  プッシュに失敗しましたが、ローカルは更新されました")
            
    except Exception as e:
        print(f"❌ エラー: {e}")
        sys.exit(1)
        
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
