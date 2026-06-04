import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ModalSheet } from '../components/ModalSheet';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { formatDate } from '../lib/format';
import { isImageAvatar } from '../lib/petAvatar';

type ActivityTarget = 'likedHospitals' | 'likedReviews' | 'writtenReviews' | 'reviewDrafts' | 'recordDrafts';
type AccountAction = 'nickname' | 'photo';

const profileEmojiOptions = ['🐾', '🦎', '🐹', '🦜', '🐢'];

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
  const [selectedAccountAction, setSelectedAccountAction] = useState<AccountAction | null>(null);
  const [draftNickname, setDraftNickname] = useState(user.nickname);
  const [draftProfileEmoji, setDraftProfileEmoji] = useState(user.profileEmoji);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const [selectedActivityTarget, setSelectedActivityTarget] = useState<ActivityTarget | null>(null);

  const likedHospitals = [...hospitals]
    .filter((hospital) => hospital.liked)
    .sort((a, b) => new Date(b.likedAt ?? 0).getTime() - new Date(a.likedAt ?? 0).getTime());
  const likedReviews = [...reviews]
    .filter((review) => review.liked)
    .sort((a, b) => new Date(b.likedAt ?? 0).getTime() - new Date(a.likedAt ?? 0).getTime());
  const writtenReviews = [...reviews]
    .filter((review) => review.isMine || review.userId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    {
      label: '내가 쓴 리뷰',
      value: writtenReviews.length,
      icon: 'reviews' as const,
      target: 'writtenReviews' as const,
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
      '계정을 삭제하면 프로필, 리뷰, 반려동물 관리 데이터, 진료기록이 모두 삭제되고 복구할 수 없어요. 계속할까요?',
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

  function openLikedHospitalOnMap(hospitalId: string) {
    setSelectedActivityTarget(null);
    navigate('/', {
      state: {
        hospitalId,
      },
    });
  }

  function openReviewDetail(reviewId: string) {
    setSelectedActivityTarget(null);
    navigate(`/reviews/${encodeURIComponent(reviewId)}`, {
      state: {
        returnTo: '/profile',
      },
    });
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#f6fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-[#18b996]" />

      <div className="relative">
        <section className="min-h-[14rem] pb-6 pt-7 text-white">
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em]">프로필</h1>
          <div className="mt-5 flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[2.25rem] bg-white/18 text-5xl shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur">
              {isImageAvatar(user.profileEmoji) ? (
                <img src={user.profileEmoji} alt="프로필 사진" className="h-full w-full object-cover" />
              ) : (
                user.profileEmoji
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[2.45rem] font-semibold leading-tight tracking-[-0.03em]">{user.nickname}</h1>
              <p className="mt-2 flex items-center gap-1.5 break-all text-xs font-medium text-emerald-50/80">
                <Icon name="mail" className="h-3.5 w-3.5" />
                <span className="min-w-0 flex-1">{accountEmail}</span>
              </p>
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
                  onClick={() => setSelectedActivityTarget(card.target)}
                  className={`rounded-[1.6rem] border border-emerald-100 bg-[#f4fbf7] p-4 text-left transition active:scale-[0.98] ${
                    card.target === 'writtenReviews' ? 'col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
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
              <div className="mt-4 rounded-[1.5rem] border border-emerald-100 bg-[#f7fcf9] p-4">
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
                    placeholder=""
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
                  className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"
                >
                  저장하기
                </button>
              </div>
            ) : null}
          </section>

          <ModalSheet
            open={Boolean(selectedActivityTarget)}
            title={activityCards.find((card) => card.target === selectedActivityTarget)?.label ?? '활동 모아보기'}
            description="선택한 항목을 한 번에 볼 수 있어요."
            onClose={() => setSelectedActivityTarget(null)}
          >
            <div className="space-y-3">
              {selectedActivityTarget === 'likedHospitals' ? (
                likedHospitals.length > 0 ? (
                  likedHospitals.map((hospital) => (
                    <button
                      key={hospital.id}
                      type="button"
                      onClick={() => openLikedHospitalOnMap(hospital.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-emerald-100 bg-[#f7fcf9] p-4 text-left transition active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{hospital.name}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{hospital.address}</p>
                      </div>
                      <Icon name="heart" className="h-5 w-5 shrink-0 text-rose-500" />
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">아직 좋아요한 병원이 없어요.</p>
                )
              ) : null}

              {selectedActivityTarget === 'likedReviews' ? (
                likedReviews.length > 0 ? (
                  likedReviews.map((review) => (
                    <button
                      key={review.id}
                      type="button"
                      onClick={() => openReviewDetail(review.id)}
                      className="w-full rounded-lg border border-emerald-100 bg-[#f7fcf9] p-4 text-left transition active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{review.petName} 리뷰</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{hospitalNames[review.hospitalId] ?? '이름 없는 병원'}</p>
                          <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">동물 종</span>{review.species}</p>
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">병원</span>{hospitalNames[review.hospitalId] ?? '이름 없는 병원'}</p>
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">병명</span>{review.diagnosis || '미입력'}</p>
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">처방</span>{review.medicine}</p>
                          </div>
                        </div>
                        <Icon name="star" className="h-5 w-5 shrink-0 text-amber-500" />
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">아직 좋아요한 리뷰가 없어요.</p>
                )
              ) : null}

              {selectedActivityTarget === 'writtenReviews' ? (
                writtenReviews.length > 0 ? (
                  writtenReviews.map((review) => (
                    <button
                      key={review.id}
                      type="button"
                      onClick={() => openReviewDetail(review.id)}
                      className="w-full rounded-lg border border-emerald-100 bg-[#f7fcf9] p-4 text-left transition active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{review.petName} 리뷰</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{hospitalNames[review.hospitalId] ?? '이름 없는 병원'}</p>
                          <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">동물 종</span>{review.species}</p>
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">병원</span>{hospitalNames[review.hospitalId] ?? '이름 없는 병원'}</p>
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">병명</span>{review.diagnosis || '미입력'}</p>
                            <p className="rounded-md bg-slate-50 px-3 py-2"><span className="mr-2 font-semibold text-slate-500">처방</span>{review.medicine || '미입력'}</p>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">작성일 {formatDate(review.createdAt)}</p>
                        </div>
                        <Icon name="reviews" className="h-5 w-5 shrink-0 text-emerald-600" />
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">아직 작성한 리뷰가 없어요.</p>
                )
              ) : null}

              {selectedActivityTarget === 'reviewDrafts' ? (
                sortedReviewDrafts.length > 0 ? (
                  sortedReviewDrafts.map((draft) => (
                    <div key={draft.id} className="rounded-lg border border-emerald-100 bg-[#f7fcf9] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{hospitalNames[draft.hospitalId ?? ''] ?? '병원 미선택'}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{petNames[draft.petId ?? ''] ?? '반려동물 미선택'}{draft.diagnosis ? ` · ${draft.diagnosis}` : ''}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{draft.body || draft.medicine || '작성 중인 리뷰 초안'}</p>
                          {draft.updatedAt ? <p className="mt-2 text-xs text-slate-400">최근 저장 {formatDate(draft.updatedAt)}</p> : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => navigate('/reviews', { state: { openComposer: true, draft, returnTo: '/profile' } })} className="rounded-full bg-white px-3 py-2 text-xs font-medium text-emerald-700">이어쓰기</button>
                          <button type="button" onClick={() => deleteReviewDraft(draft.id ?? '')} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500">삭제</button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">저장된 리뷰 초안이 없어요.</p>
                )
              ) : null}

              {selectedActivityTarget === 'recordDrafts' ? (
                sortedRecordDrafts.length > 0 ? (
                  sortedRecordDrafts.map((draft) => (
                    <div key={draft.id} className="rounded-lg border border-emerald-100 bg-[#f7fcf9] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{petNames[draft.petId ?? ''] ?? '반려동물 미선택'}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{hospitalNames[draft.hospitalId ?? ''] ?? '병원 미선택'}{draft.date ? ` · ${formatDate(draft.date)}` : ''}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{draft.diagnosis || draft.memo || '작성 중인 진료 기록 초안'}</p>
                          <p className="mt-2 text-xs text-slate-400">최근 저장 {formatDate(draft.updatedAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => navigate('/mypets', { state: { openRecordEditor: true, draftRecord: draft, returnTo: '/profile' } })} className="rounded-full bg-white px-3 py-2 text-xs font-medium text-emerald-700">이어쓰기</button>
                          <button type="button" onClick={() => deleteMedicalRecordDraft(draft.id)} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500">삭제</button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-emerald-100 bg-emerald-50/50 px-4 py-6 text-sm text-slate-500">저장된 기록 초안이 없어요.</p>
                )
              ) : null}
            </div>
          </ModalSheet>

        </div>
      </div>
    </div>
  );
}
