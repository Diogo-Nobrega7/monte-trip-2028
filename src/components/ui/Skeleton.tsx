import { cx } from './cx'
/** Bloco de carregamento. Usado enquanto dados remotos carregam (etapa 2 em diante). */
export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton rounded-md', className)} aria-hidden />
