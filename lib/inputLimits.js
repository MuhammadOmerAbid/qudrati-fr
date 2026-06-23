export const limitPhoneNumber = (value) => String(value || '').replace(/\D/g, '').slice(0, 11)
