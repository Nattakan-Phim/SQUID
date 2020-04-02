import { getQRData } from '../api'
import { useEffect, useState } from 'react'
import moment from 'moment-timezone'
import 'moment/locale/th'
import AsyncStorage from '@react-native-community/async-storage'
interface QRData {
  data: {
    anonymousId: string
    code: string
  }
  qr: {
    type: string
    base64: string
  }
}

export const QR_STATE = {
  INITIAL: 'initial',
  NORMAL: 'normal',
  OUTDATE: 'outdate',
  EXPIRE: 'outdate',
}

export const useSelfQR = () => {
  const [qrData, setQRData] = useState(null)
  const [qrState, setQRState] = useState(QR_STATE.INITIAL)
  const [error, setError] = useState(null)
  useEffect(() => {
    const updateQR = async () => {
      try {
        const _qrData = await getQRData()
        const qrData = await SelfQR.setCurrentQRFromQRData(_qrData)
        const qrState = SelfQR.getCurrentState()
        setQRData(qrData)
        setQRState(qrState)
        setError(null)
        setTimeout(updateQR, 60 * 1000) // Update after 1 min
      } catch (error) {
        console.log(error)
        setError(error)
        setTimeout(updateQR, 5 * 1000) // Retry after 5 sec
      }
    }

    const setQRFromStorage = async () => {
      const qrData = await SelfQR.getCurrentQR()
      setQRData(qrData)
    }

    setQRFromStorage().then(() => updateQR())
  }, [])

  return { qrData, qrState, error }
}

class QR {
  code: string
  constructor(code) {
    this.code = code
  }
  getStatusColor() {
    return STATUS_COLORS[this.code]
  }
  getLevel() {
    return LEVELS[this.code]
  }
  getScore() {
    return SCORES[this.code]
  }
  getLabel() {
    return LABELS[this.code]
  }
}

class SelfQR extends QR {
  qrData: QRData
  code: string
  timestamp: number

  private static currentQR: SelfQR = null

  public static async getCurrentQR() {
    if (!this.currentQR) {
      try {
        this.currentQR = new SelfQR(
          JSON.parse(await AsyncStorage.getItem('selfQRData')),
        )
      } catch (error) {
        console.log(error)
      }
    }
    return this.currentQR
  }

  public static async setCurrentQRFromQRData(qrData: QRData) {
    try {
      await AsyncStorage.setItem('selfQRData', JSON.stringify(qrData))
    } catch (error) {
      console.log(error)
    }
    this.currentQR = new SelfQR(qrData)
    return this.currentQR
  }

  public static getCurrentState() {
    if (!this.currentQR) {
      return QR_STATE.INITIAL
    }
    const time = Date.now() - this.currentQR.timestamp
    if (time < 10 * 1000) {
      return QR_STATE.NORMAL
    }
    if (time < 3 * 60 * 1000) {
      return QR_STATE.OUTDATE
    }
    return QR_STATE.EXPIRE
  }

  constructor(qrData: QRData) {
    super(qrData.data.code)
    this.qrData = qrData
    this.timestamp = Date.now()
  }
  getAnonymousId() {
    return this.qrData.data.anonymousId
  }
  getQRImageURL() {
    return `data:${this.qrData.qr.type};base64,` + this.qrData.qr.base64
  }
  getCreatedDate(): moment {
    return moment(this.timestamp).locale('th')
  }
}

interface DecodedResult {
  _: [string, 'G' | 'Y' | 'O' | 'R']
  iat: number
  iss: string
}
export class QRResult extends QR {
  iat: number
  code: string
  annonymousId: string
  iss: string
  constructor(decodedResult: DecodedResult) {
    super(CODE_MAP[decodedResult._[1]])
    this.annonymousId = decodedResult._[0]
    this.iat = decodedResult.iat
    this.iss = decodedResult.iss

    // this.code = 'yellow'
  }
  getCreatedDate(): moment {
    return moment(this.iat * 1000).locale('th')
  }
}

const STATUS_COLORS = {
  green: '#27C269',
  yellow: '#E5DB5C',
  orange: '#E18518',
  red: '#EC3131',
  DEFAULT: '#B4B5C1',
}
const LEVELS = {
  green: 1,
  yellow: 2,
  orange: 3,
  red: 4,
}
const SCORES = {
  green: 100,
  yellow: 80,
  orange: 50,
  red: 30,
}
const LABELS = {
  green: 'ความเสี่ยงต่ำ',
  orange: 'ความเสี่ยงปานกลาง',
  yellow: 'ความเสี่ยงสูง',
  red: 'ความเสี่ยงสูงมาก',
}
const CODE_MAP = {
  G: 'green',
  Y: 'yellow',
  O: 'orange',
  R: 'red',
}
const GEN_ACTION = 'ล้างมือ สวมหน้ากาก หลีกเลี่ยงที่แออัด'
const SPEC_ACTIONS = {
  YELLOW: 'อาจเป็นโรคอื่น ถ้า 2 วัน อาการไม่ดีขึ้นให้ไปพบแพทย์',
  ORANGE:
    'เนื่องจากท่านมีประวัติเดินทางจากพื้นที่เสี่ยง ให้กักตัว 14 วัน พร้อมเฝ้าระวังอาการ ถ้ามีอาการไข้ ร่วมกับ อาการระบบทางเดินหายใจ ให้ติดต่อสถานพยาบาลทันที',
  RED: 'ให้ติดต่อสถานพยาบาลทันที',
}
