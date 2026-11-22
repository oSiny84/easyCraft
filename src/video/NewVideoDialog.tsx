// 새 영상 작품의 방향 고르기(영상 계약 §2 orientation). 가로 영상(1920×1080)과 쇼츠(세로 1080×1920) 중 하나를 고른다.
// 고른 방향은 작품이 끝날 때까지 바뀌지 않는다. 방향이 다른 영상을 넣으면 검은 여백과 함께 들어간다.
import { useEffect, useRef } from 'react';
import type { Orientation } from '../domain/videoTypes';

const CHOICES: { orientation: Orientation; label: string; text: string }[] = [
  { orientation: 'landscape', label: '가로 영상', text: '옆으로 긴 화면이에요. 유튜브 보통 영상이나 TV로 볼 때 좋아요.' },
  { orientation: 'portrait', label: '쇼츠', text: '세로로 긴 화면이에요. 휴대폰으로 보는 유튜브 쇼츠에 좋아요.' },
];

export function NewVideoDialog({ onChoose, onClose }: { onChoose: (orientation: Orientation) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  // 뒤에 열린 편집기의 단축키(지우기·되돌리기·스페이스 재생)가 받지 않게 키를 이 창에서 멈춘다.
  return <div className="dialog-backdrop"><div className="dialog new-video-dialog" role="dialog" aria-modal="true" aria-label="새 영상 고르기"
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose(); }}>
    <h2>어떤 영상을 만들까요?</h2>
    <p>만든 뒤에는 바꿀 수 없어요. 모양이 다른 영상을 넣으면 위아래나 양옆이 검게 채워져요.</p>
    <div className="orientation-choices">
      {CHOICES.map((choice, index) => <button key={choice.orientation} ref={index === 0 ? first : undefined} className={`orientation-choice ${choice.orientation}`}
        aria-label={choice.label} onClick={() => onChoose(choice.orientation)}>
        <span className="orientation-shape" aria-hidden="true" />
        <strong>{choice.label}</strong>
        <span>{choice.text}</span>
      </button>)}
    </div>
    <div className="dialog-actions"><button className="outline" onClick={onClose}>취소</button></div>
  </div></div>;
}
