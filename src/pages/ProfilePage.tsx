import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { formatDate } from '../lib/format';
import { loadNaverMapSdk } from '../lib/naverMaps';
import { isImageAvatar } from '../lib/petAvatar';
import type { NaverGlobal, NaverReverseGeocodeResponse } from '../lib/naverMaps';

type ActivityTarget = 'likedHospitals' | 'likedReviews' | 'reviewDrafts' | 'recordDrafts';
type AccountAction = 'nickname' | 'photo';

const profileEmojiOptions = ['🐾', '🦎', '🐹', '🦜', '🐢'];

function getCurrentRegionLabel(response: NaverReverseGeocodeResponse) {
  const region = response.v2?.results?.[0]?.region;
  const area2 = region?.area2?.name;
  const area3 = region?.area3?.name;

  return [area2, area3].filter(Boolean).join(' ');
}

function reverseGeocodeCurrentRegion(naver: NaverGlobal, lat: number, lng: number) {
  return new Promise<string>((resolve, reject) => {
    const coords = new naver.maps.LatLng(lat, lng);
    const orders = [naver.maps.Service.OrderType.ADDR, naver.maps.Service.OrderType.ROAD_ADDR].join(',');

    naver.maps.Service.reverseGeocode({ coords, orders }, (status, response) => {
      if (status !== naver.maps.Service.Status.OK) {
        reject(new Error('현재 위치 주소를 찾지 못했어요.'));
        return;
      }

      const regionLabel = getCurrentRegionLabel(response);

      if (!regionLabel) {
        reject(new Error('현재 위치 주소 정보가 비어 있어요.'));
        return;
      }

      resolve(regionLabel);
    });
  });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { authUser, deleteAccount, signOut } = useAuth();
  const {
    clearAllLocalData,
    hospitals,
    pets,
    reviews,
    reviewDrafts,
    medicalRecordDrafts,
    deleteReviewDraft,
    deleteMedicalRecordDraft,
    saveUserProfile,
    user,
  } = useAppContext();
  const accountEmail = authUser?.email ?? user.email;
  const [currentRegion, setCurrentRegion] = useState('현재 위치 확인 중');
  const [selectedAccountAction, setSelectedAccountAction] = useState<AccountAction | null>(null);
  const [draftNickname, setDraftNickname] = useState(user.nickname);
  const [draftProfileEmoji, setDraftProfileEmoji] = useState(user.profileEmoji);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const likedHospitalsSectionRef = useRef<HTMLElement | null>(null);
  const likedReviewsSectionRef = useRef<HTMLElement | null>(null);
  const reviewDraftsSectionRef = useRef<HTMLElement | null>(null);
  const recordDraftsSectionRef = useRef<HTMLElement | null>(null);

  const likedHospitals = [...hospitals]
    .filter((hospital) => hospital.liked)
    .sort((a, b) => new Date(b.likedAt ?? 0).getTime() - new Date(a.likedAt ?? 0).getTime());
  const likedReviews = [...reviews]
    .filter((review) => review.liked)
    .sort((a, b) => new Date(b.likedAt ?? 0).getTime() - new Date(a.likedAt ?? 0).getTime());
  const sortedReviewDrafts = [...reviewDrafts].sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
  );
  const sortedRecordDrafts = [...medicalRecordDrafts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const activityCards = [
    {
      label: '좋아요한 병원',
      value: likedHospitals.length,
      icon: 'heart' as const,
      target: 'likedHospitals' as const,
    },
    {
      label: '좋아요한 리뷰',
      value: likedReviews.length,
      icon: 'star' as const,
      target: 'likedReviews' as const,
    },
    {
      label: '리뷰 임시 저장',
      value: sortedReviewDrafts.length,
      icon: 'edit' as const,
      target: 'reviewDrafts' as const,
    },
    {
      label: '기록 임시 저장',
      value: sortedRecordDrafts.length,
      icon: 'calendar' as const,
      target: 'recordDrafts' as const,
    },
  ];

  const hospitalNames = hospitals.reduce<Record<string, string>>((acc, hospital) => {
    acc[hospital.id] = hospital.name;
    return acc;
  }, {});

  const petNames = pets.reduce<Record<string, string>>((acc, pet) => {
    acc[pet.id] = pet.name;
    return acc;
  }, {});

  useEffect(() => {
    setDraftNickname(user.nickname);
    setDraftProfileEmoji(user.profileEmoji);
  }, [user]);

  function scrollToActivitySection(target: ActivityTarget) {
    const targetRef = {
      likedHospitals: likedHospitalsSectionRef,
      likedReviews: likedReviewsSectionRef,
      reviewDrafts: reviewDraftsSectionRef,
      recordDrafts: recordDraftsSectionRef,
    }[target];

    targetRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function handleProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftProfileEmoji(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function handleSaveSelectedAction() {
    setAccountMessage('');
    saveUserProfile({
      loginId: user.loginId,
      nickname: draftNickname.trim() || user.nickname,
      email: accountEmail,
      profileEmoji: draftProfileEmoji,
    });
    setSelectedAccountAction(null);
  }

  async function handleSignOut() {
    const shouldSignOut = window.confirm('정말 로그아웃 하시겠어요?');

    if (!shouldSignOut) {
      return;
    }

    await signOut();
  }

  async function handleDeleteAccount() {
    const shouldDelete = window.confirm(
      '계정을 삭제하면 프로필, 리뷰, 마이펫, 진료기록이 모두 삭제되고 복구할 수 없어요. 계속할까요?',
    );

    if (!shouldDelete) {
      return;
    }

    const shouldDeleteFinally = window.confirm('정말로 계정을 삭제하시겠어요?');

    if (!shouldDeleteFinally) {
      return;
    }

    setAccountMessage('');
    setAccountDeleteLoading(true);

    try {
      await deleteAccount();
      clearAllLocalData(user.id);
    } catch (error) {
      setAccountMessage(
        error instanceof Error ? error.message : '계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setAccountDeleteLoading(false);
    }
  }

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const naver = await loadNaverMapSdk();
          const nextRegion = await reverseGeocodeCurrentRegion(
            naver,
            position.coords.latitude,
            position.coords.longitude,
          );

          if (!cancelled) {
            setCurrentRegion(nextRegion);
          }
        } catch {
          if (!cancelled) {
            setCurrentRegion('현재 위치를 불러오지 못했어요');
          }
        }
      },
      () => {
        if (!cancelled) {
          setCurrentRegion('위치 권한을 허용하면 현재 위치가 보여요');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#f6fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,_#19c39b_0%,_#11ab8b_100%)]" />

      <div className="relative">
        <section className="min-h-[11rem] text-white">
          <p className="text-sm font-medium text-emerald-50/90">내 정보</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[2rem] bg-white/18 text-4xl shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur">
              {isImageAvatar(user.profileEmoji) ? (
                <img src={user.profileEmoji} alt="프로필 사진" className="h-full w-full object-cover" />
              ) : (
                user.profileEmoji
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[2rem] font-semibold tracking-[-0.03em]">{user.nickname}</h1>
              <p className="mt-2 flex items-center gap-2 break-all text-sm text-emerald-50/90">
                <Icon name="mail" className="h-4 w-4" />
                <span className="min-w-0 flex-1">{accountEmail}</span>
              </p>
              <p className="mt-1 break-words text-sm text-emerald-50/90">{currentRegion}</p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)] backdrop-blur">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">내 활동</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {activityCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => scrollToActivitySection(card.target)}
                  className="rounded-[1.6rem] border border-emerald-100 bg-[linear-gradient(180deg,_#f5fffb,_#eefaf6)] p-4 text-left transition active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                      <Icon name={card.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                      {card.value}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-600">{card.label}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]">
            <h2 className="text-lg font-semibold text-slate-900">계정 관리</h2>

            <div className="mt-4 divide-y divide-slate-100">
              <button
                type="button"
                onClick={() => setSelectedAccountAction('nickname')}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="font-medium text-slate-700">닉네임 수정</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                  <Icon name="chevron" className="h-5 w-5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccountAction('photo')}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="font-medium text-slate-700">프로필 사진 수정</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                  <Icon name="chevron" className="h-5 w-5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="font-medium text-rose-500">로그아웃</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-400">
                  <Icon name="x" className="h-5 w-5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={accountDeleteLoading}
                className="flex w-full items-center justify-between py-4 text-left disabled:opacity-60"
              >
                <span className="font-medium text-rose-600">
                  {accountDeleteLoading ? '계정 삭제 중...' : '계정 삭제'}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-400">
                  <Icon name="trash" className="h-5 w-5" />
                </span>
              </button>
            </div>

            {accountMessage ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {accountMessage}
              </p>
            ) : null}

            {selectedAccountAction ? (
              <div className="mt-4 rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,_#f9fffc,_#f1fbf7)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {selectedAccountAction === 'nickname' && '닉네임 수정'}
                      {selectedAccountAction === 'photo' && '프로필 사진 수정'}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      저장하면 프로필 화면과 리뷰 작성자 이름에 바로 반영됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountAction(null)}
                    className="rounded-full bg-white p-3 text-slate-500 shadow-sm"
                    aria-label="계정 관리 닫기"
                  >
                    <Icon name="x" className="h-5 w-5" />
                  </button>
                </div>

                {selectedAccountAction === 'nickname' ? (
                  <input
                    type="text"
                    value={draftNickname}
                    onChange={(event) => setDraftNickname(event.target.value)}
                    className="mt-4 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-slate-700"
                    placeholder="닉네임 입력"
                  />
                ) : null}

                {selectedAccountAction === 'photo' ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.6rem] bg-white text-4xl shadow-sm">
                        {isImageAvatar(draftProfileEmoji) ? (
                          <img
                            src={draftProfileEmoji}
                            alt="프로필 사진 미리보기"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          draftProfileEmoji
                        )}
                      </div>
                      <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-3 text-sm font-medium text-emerald-700">
                        사진 업로드
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePhotoChange}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      {profileEmojiOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setDraftProfileEmoji(option)}
                          className={`rounded-2xl px-4 py-3 text-2xl ${
                            draftProfileEmoji === option ? 'bg-emerald-600 text-white' : 'bg-white'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveSelectedAction}
                  className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,_#10b981,_#0f766e)] px-4 py-3 font-semibold text-white"
                >
                  저장하기
                </button>
              </div>
            ) : null}
          </section>

          <section
            ref={likedHospitalsSectionRef}
            className="scroll-mt-5 rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">좋아요한 병원</h2>
              <span className="text-sm text-slate-400">{likedHospitals.length}개</span>
            </div>

            <div className="mt-4 space-y-3">
              {likedHospitals.length > 0 ? (
                likedHospitals.map((hospital) => (
                  <div
                    key={hospital.id}
                    className="flex items-center justify-between rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,_#f9fffc,_#f1fbf7)] p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{hospital.name}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{hospital.address}</p>
                    </div>
                    <Icon name="heart" className="h-5 w-5 shrink-0 text-rose-500" />
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">
                  아직 좋아요한 병원이 없어요.
                </div>
              )}
            </div>
          </section>

          <section
            ref={likedReviewsSectionRef}
            className="scroll-mt-5 rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">좋아요한 리뷰</h2>
              <span className="text-sm text-slate-400">{likedReviews.length}개</span>
            </div>

            <div className="mt-4 space-y-3">
              {likedReviews.length > 0 ? (
                likedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,_#f9fffc,_#f1fbf7)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {review.petName} 리뷰
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {hospitalNames[review.hospitalId] ?? '이름 없는 병원'}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                          {review.body || review.diagnosis}
                        </p>
                      </div>
                      <Icon name="star" className="h-5 w-5 shrink-0 text-amber-500" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">
                  아직 좋아요한 리뷰가 없어요.
                </div>
              )}
            </div>
          </section>

          <section
            ref={reviewDraftsSectionRef}
            className="scroll-mt-5 rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">리뷰 임시 저장</h2>
              <span className="text-sm text-slate-400">{sortedReviewDrafts.length}개</span>
            </div>

            <div className="mt-4 space-y-3">
              {sortedReviewDrafts.length > 0 ? (
                sortedReviewDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,_#f9fffc,_#f1fbf7)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {hospitalNames[draft.hospitalId ?? ''] ?? '병원 미선택'}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {petNames[draft.petId ?? ''] ?? '반려동물 미선택'}
                          {draft.diagnosis ? ` · ${draft.diagnosis}` : ''}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                          {draft.body || draft.medicine || '작성 중인 리뷰 초안'}
                        </p>
                        {draft.updatedAt ? (
                          <p className="mt-2 text-xs text-slate-400">최근 저장 {formatDate(draft.updatedAt)}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/reviews', {
                              state: {
                                openComposer: true,
                                draft,
                              },
                            })
                          }
                          className="rounded-full bg-white px-3 py-2 text-xs font-medium text-emerald-700"
                        >
                          이어쓰기
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReviewDraft(draft.id ?? '')}
                          className="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">
                  저장된 리뷰 초안이 없어요.
                </div>
              )}
            </div>
          </section>

          <section
            ref={recordDraftsSectionRef}
            className="scroll-mt-5 rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">기록 임시 저장</h2>
              <span className="text-sm text-slate-400">{sortedRecordDrafts.length}개</span>
            </div>

            <div className="mt-4 space-y-3">
              {sortedRecordDrafts.length > 0 ? (
                sortedRecordDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,_#f9fffc,_#f1fbf7)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {petNames[draft.petId ?? ''] ?? '반려동물 미선택'}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {hospitalNames[draft.hospitalId ?? ''] ?? '병원 미선택'}
                          {draft.date ? ` · ${formatDate(draft.date)}` : ''}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                          {draft.diagnosis || draft.memo || '작성 중인 진료 기록 초안'}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">최근 저장 {formatDate(draft.updatedAt)}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/mypets', {
                              state: {
                                openRecordEditor: true,
                                draftRecord: draft,
                              },
                            })
                          }
                          className="rounded-full bg-white px-3 py-2 text-xs font-medium text-emerald-700"
                        >
                          이어쓰기
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMedicalRecordDraft(draft.id)}
                          className="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">
                  저장된 기록 초안이 없어요.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
