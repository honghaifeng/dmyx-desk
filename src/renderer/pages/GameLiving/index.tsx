import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  VideoSourceType,
  VideoMirrorModeType,
  RenderModeType,
  ScreenCaptureSourceType,
  ClientRoleType,
  RtcConnection,
  RtcStats,
  UserOfflineReasonType
} from 'agora-electron-sdk'
import styles from './index.scss'
import { debounce, generateRandomNumber } from '../../utils'
import RtmClient from '../../utils/rtm-client'
import { checkAppInstall, startApp, checkAppInfoEvent, startAppInfoEvent} from '../../utils/ipcRenderEvent'
import Config from '../../config/agora.config'
import apiClient from '../../utils/request'
import { message } from 'antd'

const defaultConfig= {
  appId: '0411799bd126418c9ea73cb37f2c40b4',
  userId: 1001,
  openId: 'opid001',
  userName: '游戏主播1',
  channelName: 'gameroom1',
  gameScreenX: 1920,
  gameScreenY: 1080,
  gameScreenFPS: 30,
  gameBitrate: 100000,
  hostScrrenX: 320,
  hostScrrenY: 320,
  hostBitrate: 500,
  hostFPS: 15
}
interface ScreenCaptureParameters {
  width?: number,
  height?: number,
  bitrate?: number,
  frameRate?: number
}

const GameLivingPage : React.FC = () => {
  const [appConfig, setAppConfig] = useState(defaultConfig)
  const [personList, setPersonList] = useState<any>([])
  const [msgList, setMsgList] = useState<any[]>([])
  const [globalDisable, setGlobalDisable] = useState(true)
  const [isGameShow, setIsGameShow] = useState(false)
  const [startLiving, setStartLiving] = useState(false)
  const [startVisit, setStartVisit] = useState(false)
  const [awardInfo, setAwardInfo] = useState({ dianzan: 5,rose: 1,bomb: 1,rocket: 1 })
  const [inputMsg, setInputMsg] = useState<string>('')
  const [isAppExist, setIsAppExist] = useState(true)
  const isAppStart = useRef(false)
  const gameRef = useRef(null)
  const metaRef = useRef(null)
  const visterRef = useRef(null)
  const msgListRef = useRef<any>(null)
  const visitor = useRef(undefined)
  const engine = useRef(createAgoraRtcEngine())
  const RTM = useRef(new RtmClient())
  const appName = 'pangkezhengba_agora'

  useEffect(() => {
    console.log('dddddd')
    initEngine()
    initRtm()
    registerIpcEvent()
    //checkAppInstall(appName)
    return () => {
      console.log('unmonut component')
      engine.current.release()
    }
  }, [appConfig.appId, appConfig.userId, appConfig.channelName])

  useEffect(() => {
    console.log('111111dddddd')
    scrollToBottom()
  }, [msgList])

  /*
  useEffect(() => {
    updateRemoteScreenVideo()
  }, [personList])
  */

  const initRtm = async () => {
    try {
      RTM.current.init(appConfig.appId)
      registerRtmEvent()
      //await RTM.current.login(appConfig.userId.toString(), '')
    } catch(e) {
      console.error('init rtm failed. error: ',e)
    }
  }

  const initEngine = () => {
    engine.current.initialize({
      appId: appConfig.appId,
      logConfig: { filePath: Config.SDKLogPath },
      channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
    })
    engine.current.enableVideo()
    engine.current.startPreview()
    registerChannelEvent()
    try {
      engine.current.destroyRendererByView(metaRef.current);
    } catch (e) {
      console.error(e);
    }
    let ret = engine.current.setupLocalVideo({
      sourceType: VideoSourceType.VideoSourceCameraPrimary,
      view: metaRef.current,
      uid: appConfig.userId,
      mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      renderMode: RenderModeType.RenderModeFit,
      cropArea: {
        width: appConfig.hostScrrenX,
        height: appConfig.hostScrrenY
      }
    });
    console.log('----ret: ',ret)
    if (ret === 0) {
      setGlobalDisable(false)
    } else {
      setGlobalDisable(true)
    }
  }

  const registerRtmEvent = () => {
    RTM.current.on('ChannelMessage', async ({ channelName, args }) => {
      const [message, memberId] = args
      console.log('channel: ', channelName, ', messsage: ', message.text, ', memberId: ', memberId)
      let newMsgList = [{
        userName: +memberId,
        msg: message.text
      }]
      console.log('------new msgList:',newMsgList)
      setMsgList((prevMsgList) => {
        return [
          ...prevMsgList,
          {
            userName: +memberId,
            msg: message.text
          }
        ]
      })
    })
  }

  const registerIpcEvent = () => {
    checkAppInfoEvent(checkAppInstallCallBack)
    startAppInfoEvent(startAppCallBack)
  }

  const checkAppInstallCallBack = (eventInfo) => {
    console.log('-----checkAppInstallCallBack: ', eventInfo)
    return true
    if (eventInfo === true) {
      setIsAppExist(true)
    } else {
      setIsAppExist(false)
    }
  }

  const startAppCallBack = (eventInfo) => {
    console.log('-----startAppCallBack: ', eventInfo)
    if (eventInfo === 'success') {
      isAppStart.current = true
      if (startScreenCapture()) {
        console.log('----startAppCallBack')
        updateGameScreenVideo() 
      } else {
        setTimeout(() => {
          startScreenCapture()
          updateGameScreenVideo() 
        }, 2000)
      }
    } else {
      isAppStart.current = false
    }
  }

  const updateRemoteScreenVideo = (remoteUid: number) => {
    engine.current.setupRemoteVideo({
      sourceType: VideoSourceType.VideoSourceRemote,
      view: null,
      uid: remoteUid,
      mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      renderMode: RenderModeType.RenderModeFit,
    });
    try {
      //engine.current.destroyRendererByView(visterRef.current);
    } catch (e) {
      console.error(e);
    }
    let ret = engine.current.setupRemoteVideo({
      sourceType: VideoSourceType.VideoSourceRemote,
      view: gameRef.current,
      uid: remoteUid,
      mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      renderMode: RenderModeType.RenderModeFit,
    });
    console.log('----updateRemoteScreenVideo ret: ',ret)
    /*
    console.log('----ret: ',ret)
    if (personList.length > 0) {
      if (visitor.current === undefined) {

        let first = personList[0]
        let connection = {
          channelId: appConfig.channelName,
          localUid: +appConfig.userId
        }
        visitor.current = first.id
        console.log('-----first: ',first)
        try {
          engine.current.destroyRendererByView(visterRef.current);
        } catch (e) {
          console.error(e);
        }
        let ret = engine.current.setupRemoteVideoEx({
          sourceType: VideoSourceType.VideoSourceRemote,
          view: visterRef.current,
          uid: +first.id,
          mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
          renderMode: RenderModeType.RenderModeFit,
        }, connection);
        console.log('----ret: ',ret)
      }
    }*/
  }

  const updateGameScreenVideo = () => {
    try {
      engine.current.destroyRendererByView(gameRef.current);
    } catch (e) {
      console.error(e);
    }
    let ret = engine.current.setupLocalVideo({
      sourceType: VideoSourceType.VideoSourceScreen,
      view: gameRef.current,
      uid: appConfig.userId,
      mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      renderMode: RenderModeType.RenderModeFit,
    });
    console.log('----ret: ',ret)
  }

  const stopGameScreenVideo = () => {
    let ret = engine.current.setupLocalVideo({
      sourceType: VideoSourceType.VideoSourceScreen,
      view: null,
      uid: appConfig.userId,
      mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      renderMode: RenderModeType.RenderModeFit,
    });
    console.log('----ret: ',ret)
  }

  const startScreenCapture = () => {
    let sources = engine.current?.getScreenCaptureSources({width: 1920, height: 1080},{width: 64, height: 64},true)
    console.log('-----startScreenCapture sources: ',sources)
    let gameSource = sources.find((item) => {
      //return item.sourceName === 'QQ'
      return item.sourceName === 'pangkezhengba_agora'
    })
    if (!gameSource) {
      console.error(`targetSource is invalid`);
      message.info('该应用程序未打开，请安装并打开该应用程序')
      return false
    }
    console.log('------22222 gameSource: ',gameSource)
    let ret = engine.current?.startScreenCaptureByWindowId(
      gameSource.sourceId,
      { width: gameSource.position?.width, height: gameSource.position?.height, x: 0, y: 30 },
      {
        dimensions: { width: appConfig.gameScreenX, height: appConfig.gameScreenY },
        bitrate: appConfig.gameBitrate,
        frameRate: appConfig.gameScreenFPS,
        captureMouseCursor: false,
        windowFocus: false,
        excludeWindowList: [],
        excludeWindowCount: 0,
      }
    )
    console.log('ret: ',ret)
    return true
  }

  const updateGameCaptureParameters = (parms: ScreenCaptureParameters) => {
    console.log('------updateGameCaptureParameters parms: ',parms)
    let ret = engine.current.updateScreenCaptureParameters({
      dimensions: { width: parms.width, height: parms.height },
      bitrate: parms.bitrate,
      frameRate: parms.frameRate,
      captureMouseCursor: false
    })
    console.log('---update ret: ',ret)
  }

  const stopScreenCapture = () => {
    console.log('-----stopScreenCapture')
    engine.current?.stopScreenCapture()
  }

  const registerChannelEvent = () => {
    engine.current.addListener(
      'onJoinChannelSuccess',
      (connection: RtcConnection, elapsed: number) => {
        console.log('onJoinChannelSuccess','connection',connection,'elapsed',elapsed)
        //setStartLiving(true)
      }
    )
    engine.current.addListener(
      'onLeaveChannel',
      (connection: RtcConnection, stats: RtcStats) => {
        console.log('onLeaveChannel','connection',connection,'stats',stats)
        //setStartLiving(false)
        setPersonList([])
        visitor.current = undefined
      }
    )
    engine.current.addListener(
      'onUserJoined',
      (connection: RtcConnection, remoteUid: number, elapsed: number) => {
        console.log('onUserJoined','connection',connection,'remoteUid',remoteUid,'elapsed', elapsed)
        let userInfo = {
          id: remoteUid,
          userName: `观众-${remoteUid}`
        }
        console.log('------personList: ',personList)
        //let newPersonList = [...personList, userInfo]
        //console.log('-----newPersonList: ',newPersonList)
        updateRemoteScreenVideo(remoteUid)
        setPersonList((prevData) => [...prevData,userInfo])
      }
    )
    engine.current.addListener(
      'onUserOffline',
      (connection: RtcConnection, remoteUid: number, reason: UserOfflineReasonType) => {
        console.log('onUserOffline','connection',connection,'remoteUid',remoteUid,'reason', reason)
        if (visitor.current === remoteUid) {
          visitor.current = undefined
        }
        setPersonList((prevList => {
          return prevList.filter((item) => {
            return item.id !== remoteUid
          })
        }))
      }
    )
  }

  const joinRtmChannel = async () => {
    if (!appConfig.channelName) {
      console.error('channelId is invalid');
      return
    }
    try {
      await RTM.current.login(appConfig.userId.toString(), '')
      await RTM.current.joinChannel(appConfig.channelName)
      RTM.current.setJoinChannelState(appConfig.channelName,true)
    } catch(error) {
      console.log('join rtm channel fialed! error is: ',error)
    }
  }

  const leaveRtmChannel = async () => {
    if (!appConfig.channelName) {
      console.error('channelId is invalid');
      return
    }
    try {
      await RTM.current.leaveChannel(appConfig.channelName)
      RTM.current.setJoinChannelState(appConfig.channelName,false)
      await RTM.current.logout()

    } catch(error) {
      console.log('join rtm channel fialed! error is: ',error)
    }
  }

  const joinChannel = async () => {
    if (!appConfig.channelName) {
      console.error('channelId is invalid');
      return
    }
    if (appConfig.userId < 0) {
      console.error('uid is invalid');
      return
    }
    let token = ''
    console.log('------join channel')
    // start joining channel
    // 1. Users can only see each other after they join the
    // same channel successfully using the same app id.
    // 2. If app certificate is turned on at dashboard, token is needed
    // when joining channel. The channel name and uid used to calculate
    // the token has to match the ones used for channel join
    engine.current.joinChannel(token, appConfig.channelName, appConfig.userId, {
      // Make myself as the broadcaster to send stream to remote
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishMediaPlayerAudioTrack: true,
      publishCameraTrack: false,
      publishScreenTrack: true,
    })
  }

  const leaveChannel = async () => {
    console.log('------leaveChannel')
    engine.current.leaveChannel()
  }

  const handleOnInputChange = debounce((id, value) => {
    console.log('----event: ',value)
    console.log('----event id: ',id)
    switch (id) {
      case 'gameScreenX':
      case 'gameScreenY':
      case 'gameScreenFPS':
      case 'gameBitrate':
        {
          let newAppConfig = {
            ...appConfig,
            [id]: +value
          }
          console.log('----newAppConfig: ',newAppConfig)
          if (isGameShow) {
            let gameCapture:ScreenCaptureParameters = {
              width: newAppConfig.gameScreenX,
              height: newAppConfig.gameScreenY,
              bitrate: newAppConfig.gameBitrate,
              frameRate: newAppConfig.gameScreenFPS
            }
            updateGameCaptureParameters(gameCapture)
          }
          setAppConfig(newAppConfig)
        }
        break
      case 'appId':
      case 'userName':
      case 'channelName':
      case 'userId':
      case 'openId':
        {
          let newAppConfig = {
            ...appConfig,
            [id]: id === 'userId'? (+value) : value
          }
          setAppConfig(newAppConfig)
        }
        break
    }
  },100)

  const handleMethodClick = (e) => {
    console.log('-----handleStartClick isGameShow: ',isGameShow)
    let isCapture = false
    if (!isGameShow) {
      isCapture = startScreenCapture()
      if (isCapture) {
        updateGameScreenVideo()
        setIsGameShow(true)
      }
    } else {
      stopScreenCapture()
      stopGameScreenVideo()
      setIsGameShow(false)
    }
    //setIsGameShow((preState) => !preState)
  }
  
  const scrollToBottom = () => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }

  const handleOnOptBtnClick = (e) => {
    console.log('-----handleOnOptBtnClick e: ',e.target.id)
    let msg = '', msg_type = '', giftid = '',giftvalue = 0
    let baseConfig = {
      roomid: appConfig.channelName,
      openid: appConfig.openId,
      avatar_url: '',
      nickname: appConfig.userName
    }
    let reqConfig
    switch (e.target.id) {
      case 'dianzanBtn': {
        msg = `${awardInfo.dianzan}个点赞`
        reqConfig = {
          ...baseConfig,
          likenum: awardInfo.dianzan,
          msg_type: 'live_like'
        }
        break
      }
      case 'roseBtn': {
        msg = `${awardInfo.rose}个玫瑰10币`
        reqConfig = {
          ...baseConfig,
          msg_type: 'live_gift',
          gift_num: awardInfo.rose,
          gift_id: '1001',
        }
        break
      }
      case 'bombBtn': {
        msg = `${awardInfo.bomb}个炸弹50币`
        reqConfig = {
          ...baseConfig,
          msg_type: 'live_gift',
          gift_num: awardInfo.bomb,
          gift_id: '1002',
        }
        break
      }
      case 'rocketBtn': {
        msg = `${awardInfo.rocket}个火箭1000币`
        reqConfig = {
          ...baseConfig,
          msg_type: 'live_gift',
          gift_num: awardInfo.rocket,
          gift_id: '1003'
        }
        break
      }
    }
    console.log('----request config: ', reqConfig)
    
    apiClient.post('live_data/living/message', reqConfig).then(response => {
      console.log(response.data)
    }).catch(err => {
      console.error(err)
    })

    
    let newMsgList = [...msgList,{
      userName: appConfig.userName,
      msg
    }]
    sendRtmMessage(msg)
    setMsgList(newMsgList)
    setAwardInfo({
      dianzan: 5,
      rose: 1,
      bomb: 1,
      rocket: 1
    })
  }

  const handleOptmsgInputChange = debounce((id, value) => {
    console.log('----event: ',value)
    console.log('-----handleOptmsgInputChange e: ',id)
    let newAward = {
      ...awardInfo,
      [id]: +value
    }
    console.log('-----newAward:',newAward)
    setAwardInfo(newAward)
  },100)

  const handleLivingClick = (e) => {
    console.log('-----handleStartLiving startLiving: ',startLiving)
    if (!startLiving) {
      setStartLiving(true)
      joinChannel()
      joinRtmChannel()
    } else {
      setStartLiving(false)
      leaveRtmChannel()
      leaveChannel()
    }
    setStartVisit(false)
  }

  const handleVisitor = (e) => {
    console.log('-----handleVisitor handleVisitor: ',startVisit)
    if (!startVisit) {
      console.log('kaishi')
      setStartVisit(true)
      joinChannel()
      joinRtmChannel()
    } else {
      console.log('jieshu ')
      setStartVisit(false)
      leaveRtmChannel()
      leaveChannel()
    }
    setStartLiving(false)
  }

  const sendRtmMessage = async (msg) => {
    await RTM.current.sendChannelMessage(msg, appConfig.channelName)
  }

  const sendMsg = (e) => {
    if (inputMsg.trim() !== '') {
      console.log('----sendMsg: ',inputMsg)
      let reqConfig = {
        roomid: appConfig.channelName,
        openid: appConfig.openId,
        avatar_url: '',
        nickname: appConfig.userName,
        msg_type: "live_comment",
        content: inputMsg
      }
      console.log('----request config: ', reqConfig)
      apiClient.post('live_data/living/message', reqConfig).then(response => {
        console.log(response.data)
      }).catch(err => {
        console.error(err)
      })
      sendRtmMessage(inputMsg)
      let newMsgList = [...msgList,{
        userName: appConfig.userName,
        msg: inputMsg
      }]
      setMsgList(newMsgList)
      scrollToBottom()
      setInputMsg('')
    }
  }

  const handleInputMsgChange = (e) => {
    setInputMsg(e.target.value)
    //inputMsg.current = e.target.value
  }

  const renderConfig = () => {
    return (
      <>
        <p style={{fontSize: '16px',paddingLeft:'4px',marginBottom:'4px'}}>应用配置</p>
        <div style={{display:'flex', flexDirection:'column',height:'80%'}}>
          {
            Object.keys(appConfig).map((key,index) => {
              return (
                <div key={`${key}-${index}`} style={{display:'flex',flex:'1', justifyContent:'space-between',marginTop:'6px',paddingLeft:'4px'}}>
                  <label>{key}</label>
                  <input disabled={globalDisable} style={{width: '60%', marginRight:'4px'}} id={key} value={appConfig[key]} onChange={(e) => handleOnInputChange(e.target.id, e.target.value)}/>
                </div>
              )
            })
          }
        </div>
      </>
    )
  }
  const renderPlayerMethod = () => {
    return (
      <>
        <p style={{fontSize: '16px',paddingLeft:'4px'}}>玩法</p>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span style={{marginLeft: '12px'}}>萌萌宠之战</span>
          <button disabled={startVisit} style={{width: '35%',marginRight:'4px'}} onClick={handleMethodClick}>{isGameShow ? '结束' : '开始'}</button>
        </div>
      </>
    )
  }

  const renderMsgOpt = () => {
    return (
      <>
        <div className={styles.optBtnWapper}>
          <div>
            <div className={styles.btnWapper}>
              <button disabled={!startLiving && !startVisit} id='dianzanBtn' onClick={handleOnOptBtnClick}>点赞</button>
              <span>x</span>
              <input disabled={!startLiving && !startVisit} id='dianzan' onChange={(e) => handleOptmsgInputChange(e.target.id, e.target.value)} value={awardInfo.dianzan} />
            </div>
          </div>
          <div style={{display: 'flex', flexDirection:'column'}}>
            <div className={styles.btnWapper}>
              <button disabled={!startLiving && !startVisit} id='roseBtn' onClick={handleOnOptBtnClick}>玫瑰10币</button>
              <span>x</span>
              <input disabled={!startLiving && !startVisit} id='rose' onChange={(e) => handleOptmsgInputChange(e.target.id, e.target.value)} value={awardInfo.rose} />
            </div>
            <div className={styles.btnWapper}>
              <button disabled={!startLiving && !startVisit} id='bombBtn' onClick={handleOnOptBtnClick}>炸弹50币</button>
              <span>x</span>
              <input disabled={!startLiving && !startVisit} id='bomb' onChange={(e) => handleOptmsgInputChange(e.target.id, e.target.value)} value={awardInfo.bomb} />
            </div>
            <div className={styles.btnWapper}>
              <button disabled={!startLiving && !startVisit} id='rocketBtn' onClick={handleOnOptBtnClick}>火箭1000币</button>
              <span>x</span>
              <input disabled={!startLiving && !startVisit} id='rocket' onChange={(e) => handleOptmsgInputChange(e.target.id, e.target.value)} value={awardInfo.rocket} />
            </div>
          </div>
        </div>
        <div className={styles.msgSend}>
          <input disabled={!startLiving && !startVisit} type="text" maxLength={200} onChange={handleInputMsgChange} placeholder='说点什么...' value={inputMsg}/>
          <button disabled={!startLiving && !startVisit} onClick={sendMsg}>发送</button>
        </div>
      </>
    )
  }

  const renderScreenMain = () => {
    console.log('-----renderScreenMain globalDisable: ',globalDisable)
    return (
      <>
        <div className={styles.game} ref={gameRef}>{(isGameShow || startVisit) ? '':'游戏预览'}</div>
        <div className={styles.person}>
          <div className={styles.meta} ref={metaRef}>{!globalDisable ? '': '房间主播预览'}</div>
        </div>
        <div className={styles.livingWapper}>
          <button disabled={startLiving} onClick={handleVisitor}>{startVisit? '结束观看':'开始观看'}</button>
          <button disabled={startVisit} onClick={handleLivingClick}>{startLiving? '结束直播':'开始直播'}</button>
        </div>
      </>
    )
  }

  const renderPersonList = () => {
    return (
      <>
        <p>在看观众</p>
        <ul className={styles.personList}>
          {
            personList.map((person,index) => {
              return (
                <li key={`${person.userName}-${index}`}>{person.userName}</li>
              )
            })
          }
        </ul>
      </>
    )
  }

  const renderMsgList = () => {
    return (
      <>
        <p className={styles.title}>互动消息</p>
        <ul className={styles.listContainer} ref={msgListRef}>
          {
            msgList.map((item,index) => {
              return (
                <li key={`${item.userName}-${index}`}>{`${item.userName} ${item.msg}`}</li>
              )
            })
          }
        </ul>
      </>
    )
  }

  return (
    <div className={styles.gameLiving}>
      <div className={styles.main}>
        <div className={styles.mainLeft}>
          <div className={styles.appConfig}>
            { renderConfig() }
          </div>
          <div className={styles.playMethod}>
            { renderPlayerMethod() }
          </div>
        </div>
        <div className={styles.screenMain}>
          { renderScreenMain() }
        </div>
        <div className={styles.online}>
          { renderPersonList() }
        </div>
      </div>
      <div className={styles.gameMessage}>
        <div className={styles.msgOpt}>
          { renderMsgOpt() }
        </div>
        <div className={styles.msgShow}>
          { renderMsgList() }
        </div>
      </div>
    </div>
  )
}

export default GameLivingPage