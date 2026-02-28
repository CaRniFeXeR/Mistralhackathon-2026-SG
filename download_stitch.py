import os
import time
import urllib.request
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

screens = [
    {"name":"Landing Page (Logo at Bottom)", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidX4y7jCpraHJJe5G2NM6Ob_AZwQmPtoFZYs6zB4Umj_8EMVNJBt8XfSv03eCDz9DwU4gCW2eT72Q9hUtQ4Y3SFudijgsp4oUVAcRBrEvHhIVlF1rt4zJ2sqWCFj6Lk6pj5THiqca6oJt8-F5HGklLeXqadt91fdFDk5aeKkmzCJHNGRZVMAE0F8rCnThoeBugkYrslXPVrqP5wstVcC7XHufIud80IAiZEpaJ0i4nVlfF-wUgTm8djuXA", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3NmIwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Screenshot 2026-02-28 161638", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidVCdOjGIFK5-IAbxZcdJbxHDbdzEfP4ak91s1EBvJM7Ot1mZpG7gUpyvAhTxxt17Ew1wYdMk5jY_-wP2AsZh5-KItQD0WFFGjksM5cmN7cDJfHKO6pNFjJzAjM-42BSIPOUuxbXQPDW4if202H13IlRuMJUseocssQxH4wBdPxezqvW16dRDnXS1l9wXAcliQjgRrFFm6lmGQoGjd_BYVcfnFyTHpr-cUFZlV8b5dwKgljUyfIryxw0tpjip59dbzbJeb3KrgApAQ", "html_url":None},
    {"name":"Defeat Screen (Corrected Art)", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidW5n7JjnPXmZxXGCHCdcTRyILNCe5Eb4SdIl-jsX5KsB9HeGcgj4HroqFKabW_Hz0bfOt07mik_IKTTu1PuRxp_3spLcyRigMDi05bx9ND4-Gp-stP9NK8xsOyQsgTySzg2VVrOzzHwhpNMXH6eH-vabL67be9yx6Vpk5-d3DFBgSz1Yc_vkhXHbxil9u_8Ef8K0veRonBd-AXD9SOf2g4VzEclNOvpQvSbv3q-yywQVuAAFpDn_wsnv2o", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3NTcwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Role Selection with Logo", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidV9nmzR33LPFljV3I8c97psKH8KHZFZFr2HumNo_kYz0EUgOh319KrLvybr9YJayC2T90FaYcLpAYCehkNbwwGZNt4OQloHxxpzR6BCgpLwmGxk5f-Vm2OH6oJ3-CAeKrhCTkQUyDqqp1D2ZPvH2wWXzFkQRiNbxtYA7pWF6z6_2BdrCYl5ABn5hkb4bM5G4yzvwwgTMvTJQwIdBMgRa3Mnp4enMzQN0LJjcSEwd3hK4mnJSItBnjQEky4", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3ODIwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Refined GM View with Mic", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidU927bLeGk3LGT8jLeqk6Q4O2QJLFnhJ0D1VmEbxbr1-eeyWnVsUqO6oBlj0lVzRR8mH8rsFjsJ4MkiHMOvsE9vG8FvsIKADi6lVFtAz9YD4KbriKFD6nn5WnHTZm5BicsJki8J7eksTPYfeZcQVGfGRqraGWEFza58deKItiFtYATbtVqmjbKzNeLCKdw8Bk7nLwo8kcu_xvendReIv5X5rviroCZXC-IlLLUv6gkQnt1VvVZMmPBclF4", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3NjkwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Game Instructions (Updated Logo)", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidVs8FQI3DeqndI9QtRAPju_sTlkFCGvudlKXSiNw9ZJWkISRMRb3cuWKYJDP-3JsiD5yu3wUb47SoNi4D6fIZrmJ_YlvrrhqiUphXURp8u_qkaQdoNzmKSc6diSxceZIPGs1DG8rWm_fi9471PYFiwmto5Oi7eTwZMwDvadn4YBv0byTeKJ2NuM5XdsaHohk0XfkjjdMPLN-DjPpWnI_Br55KR1ycoxQvhaB8N70hSgr3JBTwQavir_EFY", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3M2MwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Refined GM View", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidUJHHFxbti4ddAKpaLlk3TY8SRKXYiU9_uOHIMyIHdm-prvk3oWa1hWXlm-JlUdcT3DPpVeagUdNtR-kLuGOwBszESF3ozAF6y9411LtLDl6oIi_11OBY9ki_7ZGFi6iB8TLR5RYajKrOqdZ-_AAqsuHtD-In5iBENHdBGN2JdItv06tvVva8bhRIJvq8FGe76nNlQhBwCf3s44a0WGIMA7aWU59_RYSat_JfusJrguo1codgPUlAM8k_Y", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3YTAwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Victory Screen (Dark)", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidXv814nicX_leM4QUH8nPEfhtJp48wt5ZCtNptCUxPuwMKbhOznmmvL2d9AqztA5ZE3k3jmY6-eP-VREcBAhf0W5G9NEF8aq_hBLID-T8VdAOw3yUS-R1rijAE5vGUy5Tp-fNupV52T6eIfZ4z1di2XqYAu0x6NG5cPXs4TzzulJrTfoZ49l6Vz8s0HtPQi7RN8rnqebeCPNvplYXr0ec4ndrce5jn7kTSWNj36u-TgWK6NHgRTOt78Hw", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3OGQwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Player View with Mic", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidUORcWatB-4-9tIWKjKoNNEkriMQFEXEOhkxDoDb1cBqc6y7xQg--VKrN35tjKtjkA9UEQ6egZCPlmYq7gycLyUKY6aFz4bb7WXkKrxW5L2dLnv61y1y8G2QC2RVgcZoi6cZ6ArKGWX-zalk1S5f2EJOt5ZuDY56ihKPmBxi1-Xhe-GpANfvlds8r6twyXgP_aAyNxORScCJrjl5QA8HjtX815gfuy-Rq4EENsRooPJFYtv-UO7gXyq5Oc", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3OTgwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"},
    {"name":"Player View (Logo at Bottom)", "img_url":"https://lh3.googleusercontent.com/aida/AOfcidVZSUvDxGJX3rMW9xRAKafmi9jzCp3Cc0JE7CU61YQi0fvzzayFJHlKlKUCi-G1OhWTMAL6VPyj02kKxjNL4n2RXRP0NJhwEyJ3nPYmSQZJlJdnHKBIPHXok0r1T-9OisgDjjszHa_R0m6xIy24sYE1QZEgBEu-X13wrq9MPnoLoINQcIVvKbdlMr6On09LT1ADQ3l6f9GmgfLFtqA2FWiTMT8zEFMJ3qduYwPEbpPCPV3buKv8EL6np2w", "html_url":"https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY0YmRlY2VhZGQ3NTkwMWViNGNjN2QzMzkxMDgyEgsSBxCTzrLvkhYYAZIBIwoKcHJvamVjdF9pZBIVQhMyMDAzNzY3OTc0MDgxMzIyODEz&filename=&opi=89354086"}
]

os.makedirs('/root/git/Mistralhackathon-2026-SG/frontend/src/stitch_designs', exist_ok=True)

import string
import urllib.request
from urllib.error import HTTPError
import subprocess

for screen in screens:
    name = screen["name"].replace(" ", "_").replace("(", "").replace(")", "").replace(".png", "")
    print(f"Downloading {name}...")
    img_path = f"/root/git/Mistralhackathon-2026-SG/frontend/src/stitch_designs/{name}.png"
    html_path = f"/root/git/Mistralhackathon-2026-SG/frontend/src/stitch_designs/{name}.html"

    if screen["img_url"] and not os.path.exists(img_path):
        try:
            subprocess.run(["curl", "-s", "-L", screen["img_url"], "-o", img_path])
        except Exception as e:
            print(f"Failed image {name}: {e}")
    
    if screen["html_url"] and not os.path.exists(html_path):
        try:
            print(f"Fetching HTML for {name} with curl...")
            subprocess.run(["curl", "-s", "-L", screen["html_url"], "-o", html_path])
            time.sleep(3)
        except Exception as e:
            print(f"Failed html {name}: {e}")
