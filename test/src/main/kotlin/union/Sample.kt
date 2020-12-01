package union

interface Type

data class Tuple(val state: List<Type>): Type

data class Reference(
  val name: composite.ID,
  val parameters: List<Type>): Type

data class Parenthesis(
  val location: composite.Location,
  val type: Type): Type
