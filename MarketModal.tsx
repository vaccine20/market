'use client'
import type { FC } from 'react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type MarketModalProps = {
  app?: App
  appInfo?: MarketAppDetailResponse
  isShow: boolean
  modalTitle: string
  marketAdd?: boolean
  onClose: () => void
  onAdd?: (data : MarketAppData) => Promise<void>
  onUpdate?: (data : MarketAppData) => Promise<void>
  onTake?: (id: string) => Promise<void>
}

export type MarketAppData = {
  app_id?: string;
  name: string;
  description: string;
  mode?: string;
  hashcode: string[];
  important: number;
}

const MarketModal: FC<MarketModalProps> = ({
  app,
  appInfo,
  marketAdd = false,
  modalTitle,
  isShow = false,
  onClose,
  onAdd,
  onUpdate,
  onTake,
}) => {
  const { notify } = useToastContext();
  const [saveLoading, setSaveLoading] = useState(false);
  const [replicateLoading, setReplicateLoading] = useState(false);
  const { t } = useTranslation();

  const appType = () => {
    switch (marketAdd ? app.mode : appInfo.mode) {
      case 'chat' : 
        return `#${t('market.types.chat')}`;
      case 'completion' : 
        return `#${t('market.types.completion')}`;        
      case 'workflow' : 
        return `#${t('market.types.workflow')}`;
      case 'agent-chat' : 
        return `#${t('market.types.agentChat')}`;
      case 'advanced-chat' : 
        return `#${t('market.types.advancedChat')}`;
      case 'analytics-chat' : 
        return `#${t('market.types.analyticsChat')}`;
      default: 
        return;
    }
  }

  const nameInput = useRef(null);
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);

  const handleAddTags = () => {
    if (hashtagInput.trim() && !hashtags.includes(hashtagInput.trim())) {
      setHashtags([...hashtags, hashtagInput.trim()]);
      setHashtagInput('');
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key == 'Enter') {
      handleAddTags();
    }
  };

  const handleDeleteTag = (tag: string) => {
    setHashtags(hashtags.filter((hash) => hash !== tag));
  };

  const [modalFormData, setModalFormData] = useState({
    name: '',
    important: 0,
    description: '',
  })

  const handleInputData = (e : any) => {
    const { name, value } = e.target;

    if (name !== 'important') {
      setModalFormData(prev => ({
        ...prev,
        [name]: value
      }))
    } else {
      const checkedValue = e.target.checked ? 1 : 0;
      setModalFormData(prev => ({
        ...prev,
        [name]: checkedValue
      }))
    }
  }

  useEffect(() => {
    if (marketAdd) {
      setModalFormData({
        name: '',
        description: '',
        important: 0
      });
      setHashtags([appType()]);
    } else {
      setModalFormData({
        name: appInfo.name,
        description: appInfo.description,
        important: +appInfo.important
      });
      setHashtags(() => (appType(), appInfo.hashcode));
    }
    
    nameInput.current.focus();
  }, [])

  const readonlyData = () => {
    return modalTitle == t('market.modal.read');
  }

  const onClickSave = async () => {
    if (!modalFormData.name.trim()) {
      notify({ type: 'error', message: t('market.modal.nameNotEmpty')});
      return;
    }
    setSaveLoading(true);
    if (marketAdd) {
      const addData = {
        app_id: app.id,
        name: modalFormData.name,
        mode: app.mode,
        hashcode: hashtags,
        description: modalFormData.description,
        important: modalFormData.important
      }
      await onAdd?.(addData);
    } else {
      const modifyData = {
        name: modalFormData.name,
        description: modalFormData.description,
        hashcode: hashtags,
        important: modalFormData.important
      }
      await onUpdate?.(modifyData);
    }
    setSaveLoading(false);
  }

  const onClickTakeIt = async () => {
    setReplicateLoading(true);
    await onTake?.(appInfo.id);
    
    setReplicateLoading(false);
  }

  const [isFocused, setIsFocused] = useState(false);

  const { hasPermission } = usePermissionContext();

  return (
    <>
      <Dialog
        titleClassName='font-semibold'
        className=' !rounded-lg !shadow-modalShadow'
        show={isShow}
        title={
            <div className='flex items-center justify-between space-y-1.5'>
              <div className='font-bold text-[28px] text-black leading-5'>
                {modalTitle}
              </div>
              <div
                className='h-6 w-6 cursor-pointer'
                onClick={onClose}
              >
                <XClose className='w-6 h-6 text-aionUneutral-40'/>
              </div>
            </div>
          }
        footer={!readonlyData() ?
          <>
            <Button onClick={onClose} type='line'>{t('common.operation.cancel')}</Button>
            <Button type='primary' onClick={onClickSave} loading={saveLoading}>{t('common.operation.save')}</Button>
          </>
          :
          <>
            <Button type='primary' onClick={onClickTakeIt} loading={replicateLoading}>{t('market.operation.cloneToWorkspace')}</Button>
          </>
        }
      >
        <div className='overflow-y-auto bg-[#F4F7FD] px-3 py-4 rounded-md'>
          {/* 앱 */}
          {marketAdd &&
            <div className='space-y-2'>
              <div className='w-16 font-bold text-base'>
                <span>{t('market.modal.app')}</span>
              </div>
              <div className='w-full h-10'>
                <input value={app.name}
                className='w-full h-full px-3 cursor-default text-sm font-normal border rounded-lg grow outline-none' 
                disabled />
              </div>
            </div>
          }
          {/* 이름 */}
          <div className={cn('space-y-2', marketAdd && 'mt-4')}>
            <div className='w-16 font-bold text-base'>
              <span>{t('market.modal.name')}</span>
            </div>
            <div className='flex w-full h-10'>
              <input
              ref={nameInput}
              name='name'
              value={modalFormData.name}
              className={cn('w-full h-full px-3 text-sm font-normal border rounded-lg grow outline-none', !readonlyData() && 'focus:border-aionUprimary-80')}
              onChange={e => {
                handleInputData(e);
              }}
              readOnly={readonlyData()}
              placeholder={t('market.appNamePlaceholder')} />
              {/* 체크박스 */}
              {hasPermission('MARKET_ADMIN', 'update') ?
                <div className='flex w-16 justify-end items-center'>
                  <input type='checkbox'
                    className='w-4 h-4'
                    name='important'
                    disabled={readonlyData()}
                    checked={modalFormData.important && true}
                    onChange={(e) => {
                      handleInputData(e);
                    }}
                  />
                  <div className='font-normal text-base ml-1'>
                    {t('market.modal.important')}
                  </div>
                </div>
                : 
                (!marketAdd &&
                  <div className='flex w-16 justify-end items-center'>
                    <input type='checkbox'
                      className='w-4 h-4'
                      checked={modalFormData.important && true}
                      disabled
                    />
                    <div className='font-normal text-base ml-1'>
                      {t('market.modal.important')}
                    </div>
                  </div>
                )
              }
            </div>
          </div>
          {/* 해시태그 */}
          <div className='mt-4 space-y-2'>
            <div className='w-16 font-bold text-base'>
              <span>{t('market.modal.hash')}</span>
            </div>
            <ul
              className={cn('w-full min-h-10 flex flex-wrap px-3 pt-2 pb-1 border rounded-lg bg-white items-center', 
                isFocused && 'border-aionUprimary-80')}
            >
              {hashtags.map((tag, index) => {

                const isFirstTag = index === 0;
                const isEditable = !readonlyData();

                return (
                  <li
                    key={index}
                    className={cn(
                      "flex w-fit shrink-0 items-center px-2 py-0.5 mb-1 mr-1 rounded text-[0.6875rem] font-bold",
                      isFirstTag
                        ? 'bg-[#F6637E]/20 text-[#F6637E]'
                        : 'bg-[#EEF0FF] text-[#626366]'
                    )}
                  >
                    <span className={cn(isEditable && !isFirstTag && 'mr-1')}>{tag}</span>
                    {isEditable && !isFirstTag && (
                      <button onClick={() => handleDeleteTag(tag)}>
                        <Close />
                      </button>
                    )}
                  </li>
                );
              })}
              {!readonlyData() &&
                <li 
                  className='flex w-full items-center mb-1 py-0.5'
                >
                  <input 
                    value={hashtagInput}
                    name='hashcode'
                    className='text-sm grow font-normal outline-none'
                    placeholder={t('market.hashPlaceholder')}
                    onChange={e => {
                      setHashtagInput(e.target.value);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                  />
                </li>
              }
            </ul>
          </div>
          {/* 설명 */}
          <div className='mt-4 space-y-2'>
            <div className='font-bold text-base'>
              {t('market.modal.description')}
            </div>
            <div className='flex items-center justify-between gap-3'>
              <textarea 
              value={modalFormData.description}
              name='description'
              readOnly={readonlyData()}
              className={cn('resize-none h-[104px] px-3 text-sm font-normal border rounded-lg grow pt-[10px] outline-none', !readonlyData() && 'focus:border-aionUprimary-80')}
              onChange={e => {
                handleInputData(e);
              }}
              placeholder={!readonlyData() ? t('market.appDescriptionPlaceholder') : ''}
              />
            </div>
            {marketAdd &&
              <div className='flex justify-center text-sm font-normal'>
                {t('market.modal.shareWithEveryone')}
              </div>
            }
          </div>
        </div>
      </Dialog>
    </>

  )
}
export default React.memo(MarketModal)
