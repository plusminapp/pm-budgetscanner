import { useState } from 'react'
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material'
import { FileDown, FileText, FileSpreadsheet } from 'lucide-react'
import { exportOverzicht } from '../export/exportRules'
import { exportPdf } from '../export/exportPdf'
import type { CategorizedTransaction, UserRule, Potje } from '../types'

interface Props {
  transacties: CategorizedTransaction[]
  jaar: number
  userRules?: UserRule[]
  learnedRules?: UserRule[]
  potjes?: Potje[]
  onJsonSaved?: () => void
}

export function OpslaanButtons({ transacties, jaar, userRules = [], learnedRules = [], potjes = [], onJsonSaved }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)

  const handleJson = () => {
    exportOverzicht(transacties, jaar, userRules, learnedRules, potjes)
    onJsonSaved?.()
    setAnchor(null)
  }

  const handlePdf = async () => {
    await exportPdf(transacties, jaar, userRules, learnedRules, potjes)
    setAnchor(null)
  }

  return (
    <>
      <Button
        variant="outlined"
        color="success"
        startIcon={<FileDown className="h-4 w-4" />}
        onClick={(e) => setAnchor(e.currentTarget)}
        size="small"
      >
        Opslaan
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={handlePdf}>
          <ListItemIcon><FileText className="h-4 w-4" /></ListItemIcon>
          <ListItemText>PDF opslaan</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleJson}>
          <ListItemIcon><FileSpreadsheet className="h-4 w-4" /></ListItemIcon>
          <ListItemText>JSON opslaan</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}
