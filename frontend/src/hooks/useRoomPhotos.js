import {useEffect,useMemo,useRef,useState} from 'react';
import {roomApi} from '../services/roomApi';
const keyOf=p=>`${p.id}:${p.capture_id||''}:${p.storage_path||p.image_url}:${p.captured_at||''}`;
export default function useRoomPhotos(photos,credentials){const cache=useRef(new Map()),[urls,setUrls]=useState({}),[error,setError]=useState(''),[retry,setRetry]=useState(0);const signature=JSON.stringify(photos.map(keyOf));
 useEffect(()=>{let active=true;const controller=new AbortController();const keys=new Set(photos.map(keyOf));for(const [key,url]of cache.current){if(!keys.has(key)){URL.revokeObjectURL(url);cache.current.delete(key);}}
 Promise.all(photos.map(async p=>{const key=keyOf(p);if(cache.current.has(key))return;const blob=await roomApi.getPhotoBlob(p,credentials,controller.signal);if(active)cache.current.set(key,URL.createObjectURL(blob));})).then(()=>{if(active){setUrls(Object.fromEntries(cache.current));setError('');}}).catch(e=>{if(active&&e.name!=='AbortError'){setUrls(Object.fromEntries(cache.current));setError('Some photos could not be loaded. Please retry.');}});return()=>{active=false;controller.abort();};},[signature,credentials?.participantToken,retry]);
 useEffect(()=>()=>{cache.current.forEach(URL.revokeObjectURL);cache.current.clear();},[]);
 return {photos:useMemo(()=>photos.map(p=>({...p,src:urls[keyOf(p)]})),[photos,urls]),error,retry:()=>setRetry(n=>n+1)};
}
